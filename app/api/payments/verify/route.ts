import { NextResponse } from "next/server";
import { cleanPaymentId, type PaymentOutcome } from "@/lib/payments";
import { fetchGatewayPayment, fetchInvoicePaymentIds, forLog, logPayment, outcomeOf, paymentsConfig, settle } from "@/lib/payments-server";
import { supabaseAs } from "@/lib/supabase";

// POST /api/payments/verify   { orderId, paymentId? }
//
// "What happened to my payment?" Called by the payment screen when the
// customer comes back from the gateway, when they reload that screen, and
// when they tap "Check again". It can be called any number of times.
//
// The page's word counts for nothing here. This route:
//   1. checks the caller is the order's own customer;
//   2. asks the GATEWAY about the payment ID from the address (if any) and
//      about every payment it holds for this order's saved invoices;
//   3. passes each answer to the database, which marks the order paid only
//      if the invoice is ours and the amount, currency and order ID match
//      (settle_payment);
//   4. answers with the order's payment status as the database now holds it.
//
// So opening the "success" address for an unpaid order, with any values in
// it, changes nothing: the gateway has no paid invoice that matches.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const answer = (outcome: PaymentOutcome, status = 200, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ outcome, requestId, ...extra }, { status });

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return answer("not_found", 401);
  const db = supabaseAs(token);
  const { data: who, error: whoError } = await db.auth.getUser(token);
  if (whoError || !who.user) return answer("not_found", 401);

  const body = (await request.json().catch(() => null)) as { orderId?: unknown; paymentId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" && UUID.test(body.orderId) ? body.orderId : null;
  if (!orderId) return answer("not_found", 404);

  // Read as the customer: row-level security returns the order only to its owner.
  const mine = await db.from("orders").select("id,ticket_ref,customer_id,payment_method,payment_status").eq("id", orderId).maybeSingle();
  if (mine.error || !mine.data || mine.data.customer_id !== who.user.id) return answer("not_found", 404);
  const order = mine.data as { id: string; ticket_ref: string; payment_method: string; payment_status: string };

  // Already settled: say so without asking anyone.
  if (order.payment_status === "paid") return answer("paid");
  if (order.payment_status === "refund_due") return answer("refund_due");

  const config = paymentsConfig();
  if ("missing" in config) {
    logPayment("error", "payment_verify_failed", { requestId, ticket: order.ticket_ref, stage: "configuration", detail: `${config.missing} is not set` });
    return answer("unavailable", 503);
  }

  // Every ID worth asking the gateway about: the one on the address first,
  // then what we saved for this order's payment pages.
  const saved = await db.from("order_payments").select("invoice_id,gateway_payment_id,status").eq("order_id", orderId).order("created_at", { ascending: false });
  const candidates = new Set<string>();
  const fromAddress = cleanPaymentId(body?.paymentId);
  if (fromAddress) candidates.add(fromAddress);
  const openInvoices: string[] = [];
  for (const row of saved.data ?? []) {
    if (row.gateway_payment_id) candidates.add(row.gateway_payment_id as string);
    // Not settled for good: the gateway may hold a newer try on this invoice.
    if (row.status === "created" || row.status === "failed" || row.status === "cancelled") openInvoices.push(row.invoice_id as string);
  }

  let outcome: PaymentOutcome = (saved.data ?? []).length > 0 ? "awaiting" : "nothing";
  let reached = false;
  let answered = false;
  try {
    // Payment pages still open: ask the gateway which payments it holds for
    // them. This finds a payment whose customer never came back.
    for (const invoice of openInvoices.slice(0, 3)) {
      for (const id of await fetchInvoicePaymentIds(config, invoice)) candidates.add(id);
    }
    for (const id of candidates) {
      const fact = await fetchGatewayPayment(config, id);
      if (!fact) continue;
      reached = true;
      const settled = await settle(config, fact);
      // An invoice we never made, or one that belongs to another order, says nothing about this order.
      if (!settled || settled.orderId !== orderId) continue;
      if (settled.changed) {
        logPayment(settled.payment === "mismatch" ? "error" : "info", "payment_settled", {
          requestId,
          ticket: order.ticket_ref,
          invoice: fact.invoiceId,
          payment: settled.payment,
          payment_status: settled.paymentStatus,
          gateway: `${fact.invoiceStatus}/${fact.transactionStatus}`,
          amount: fact.amount,
          currency: fact.currency,
        });
      }
      const result = outcomeOf(settled);
      // Paid settles the question. Otherwise the first answer stands: that is
      // the payment on the address, or failing that the newest try. Older,
      // abandoned tries must not turn "failed" back into "still waiting".
      if (result === "paid" || result === "refund_due") {
        outcome = result;
        break;
      }
      if (!answered) {
        outcome = result;
        answered = true;
      }
    }
  } catch (error) {
    logPayment("error", "payment_verify_failed", { requestId, ticket: order.ticket_ref, stage: "gateway", detail: forLog(error instanceof Error ? error.message : error) });
    return answer("unavailable", 503);
  }

  return answer(outcome, 200, { asked: candidates.size, reached });
}
