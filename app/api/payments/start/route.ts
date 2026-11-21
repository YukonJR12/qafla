import { NextResponse } from "next/server";
import { createPaymentPage, fetchGatewayPayment, fetchInvoicePaymentIds, forLog, logPayment, paymentsConfig, returnAddress, serverDb, settle } from "@/lib/payments-server";
import { supabaseAs } from "@/lib/supabase";

// POST /api/payments/start   { orderId, language }
//
// The customer has placed an order to pay online and wants the payment
// page. This route, on the server:
//   1. finds out who is asking, from their own access token;
//   2. asks the database, AS that customer, for the amount to charge
//      (begin_online_payment). The amount is the order's saved total. The
//      page never sends an amount, and one sent anyway would be ignored;
//   3. reuses the payment page made in the last 20 minutes if nobody has
//      tried to pay on it yet, so tapping "Pay" twice does not make two
//      invoices;
//   4. otherwise asks the gateway for a page and saves its invoice ID
//      against the order BEFORE the customer is sent there.
//
// It never marks anything as paid.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const refuse = (problem: string, status: number, log?: Record<string, unknown>) => {
    if (log) logPayment("error", "payment_start_failed", { requestId, problem, ...log });
    return NextResponse.json({ problem, requestId }, { status });
  };

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return refuse("not_found", 401);
  const db = supabaseAs(token);
  const { data: who, error: whoError } = await db.auth.getUser(token);
  if (whoError || !who.user) return refuse("not_found", 401);

  const body = (await request.json().catch(() => null)) as { orderId?: unknown; language?: unknown } | null;
  const orderId = typeof body?.orderId === "string" && UUID.test(body.orderId) ? body.orderId : null;
  if (!orderId) return refuse("not_found", 404);

  // The database says whether this customer may pay for this order, and how much.
  const begun = await db.rpc("begin_online_payment", { p_order_id: orderId });
  if (begun.error) {
    const code = begun.error.message;
    if (code === "order_not_found") return refuse("not_found", 404);
    if (code === "already_paid" || code === "not_online_order" || code === "order_not_payable") return refuse(code, 409);
    return refuse("unavailable", 503, { stage: "begin", order: orderId.slice(0, 8), detail: forLog(code) });
  }
  const order = begun.data as { ticket_ref: string; amount_kwd: number; open_invoice_id: string | null; open_payment_url: string | null };

  const config = paymentsConfig();
  if ("missing" in config) {
    return refuse("unavailable", 503, { stage: "configuration", order: orderId.slice(0, 8), detail: `${config.missing} is not set` });
  }

  // A payment page made a moment ago is reused only while it is untouched.
  // The gateway allows a limited number of tries on one invoice, so a page
  // that has already been tried gets a fresh invoice instead. (Anything the
  // gateway knows about the old one is settled first, in case it was paid.)
  if (order.open_invoice_id && order.open_payment_url) {
    try {
      const tried = await fetchInvoicePaymentIds(config, order.open_invoice_id);
      if (tried.length === 0) return NextResponse.json({ paymentUrl: order.open_payment_url, reused: true });
      for (const id of tried) {
        const fact = await fetchGatewayPayment(config, id);
        const settled = fact ? await settle(config, fact) : null;
        if (settled?.orderId === orderId && settled.paymentStatus !== "unpaid") return refuse("already_paid", 409);
      }
    } catch (error) {
      return refuse("unavailable", 503, { stage: "gateway", ticket: order.ticket_ref, detail: forLog(error instanceof Error ? error.message : error) });
    }
  }

  // The customer comes back to this app's own payment screen for this order.
  const returnUrl = returnAddress(request.url, orderId);
  let created: Awaited<ReturnType<typeof createPaymentPage>>;
  try {
    created = await createPaymentPage(config, {
      orderId,
      amountKwd: order.amount_kwd,
      returnUrl,
      language: body?.language === "ar" ? "AR" : "EN",
    });
  } catch (error) {
    return refuse("unavailable", 503, { stage: "gateway", ticket: order.ticket_ref, detail: forLog(error instanceof Error ? error.message : error) });
  }
  if ("error" in created) {
    return refuse("unavailable", 503, { stage: "gateway", ticket: order.ticket_ref, status: created.status, detail: created.error });
  }

  // Save the invoice against the order before anyone is redirected.
  const saved = await serverDb().rpc("record_payment_page", {
    p_secret: config.secret,
    p_order_id: orderId,
    p_invoice_id: created.page.invoiceId,
    p_payment_url: created.page.paymentUrl,
  });
  if (saved.error) {
    return refuse("unavailable", 503, { stage: "record", ticket: order.ticket_ref, invoice: created.page.invoiceId, detail: forLog(saved.error.message) });
  }

  logPayment("info", "payment_page_created", { requestId, ticket: order.ticket_ref, invoice: created.page.invoiceId, amount: Number(order.amount_kwd).toFixed(3) });
  return NextResponse.json({ paymentUrl: created.page.paymentUrl, reused: false });
}
