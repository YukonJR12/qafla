import { NextResponse } from "next/server";
import { cleanPaymentId } from "@/lib/payments";
import { fetchGatewayPayment, forLog, logPayment, paymentsConfig, settle } from "@/lib/payments-server";

// POST /api/payments/notify
//
// Where the gateway can tell us "something happened to a payment" without
// the customer coming back (they closed the tab, their phone died).
//
// A notification is treated as a nudge and nothing more. Anyone can send a
// request here, so nothing in it is believed: this route only picks out an
// ID, asks the GATEWAY about that ID with our own token, and hands the
// gateway's answer to the database (settle_payment), exactly as the
// customer's return does. Sending the same notification again, or a made-up
// one, changes nothing that the gateway does not itself confirm.
//
// A Vercel Preview is behind Vercel's sign-in, so the gateway cannot reach
// this route there. It is for the public (production) address.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Finds values under keys like PaymentId or InvoiceId anywhere in the notification. */
function idsIn(value: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (!value || typeof value !== "object" || depth > 5 || found.size >= 6) return found;
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (/^(payment_?id|invoice_?id|id)$/i.test(key) && (typeof inner === "string" || typeof inner === "number")) {
      const id = cleanPaymentId(String(inner));
      if (id) found.add(id);
    } else if (typeof inner === "object") idsIn(inner, found, depth + 1);
  }
  return found;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const config = paymentsConfig();
  if ("missing" in config) {
    logPayment("error", "payment_notify_failed", { requestId, stage: "configuration", detail: `${config.missing} is not set` });
    return NextResponse.json({ received: true }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  let settledCount = 0;
  try {
    for (const id of idsIn(body)) {
      const fact = await fetchGatewayPayment(config, id);
      if (!fact) continue;
      const settled = await settle(config, fact);
      if (!settled) continue;
      settledCount += 1;
      if (settled.changed) {
        logPayment("info", "payment_settled", { requestId, via: "notification", invoice: fact.invoiceId, payment: settled.payment, payment_status: settled.paymentStatus });
      }
    }
  } catch (error) {
    logPayment("error", "payment_notify_failed", { requestId, stage: "gateway", detail: forLog(error instanceof Error ? error.message : error) });
    // A failure answer asks the gateway to send it again later.
    return NextResponse.json({ received: false }, { status: 503 });
  }
  // The same short answer whatever was sent, so the route tells a stranger nothing.
  void settledCount;
  return NextResponse.json({ received: true });
}
