import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanPaymentId, gatewayAmount, readCreatedPage, readGatewayPayment, readInvoicePaymentIds, SANDBOX_BASE, type CreatedPage, type GatewayPayment, type PaymentOutcome } from "./payments";

// Server-only helpers for online payment. This file is imported only by the
// routes under app/api/payments, so nothing in it reaches the browser.
//
// Two secrets live in the server's environment and nowhere else:
//   MYFATOORAH_API_KEY       the gateway token (sandbox)
//   PAYMENTS_SERVER_SECRET   proves to the database that a call is ours
//                            (the database holds only its hash)

const TIMEOUT_MS = 20_000;

export type PaymentsConfig = { key: string; secret: string; base: string };

/** The settings, or the name of the first one that is missing. */
export function paymentsConfig(): PaymentsConfig | { missing: string } {
  const key = process.env.MYFATOORAH_API_KEY;
  const secret = process.env.PAYMENTS_SERVER_SECRET;
  if (!key) return { missing: "MYFATOORAH_API_KEY" };
  if (!secret) return { missing: "PAYMENTS_SERVER_SECRET" };
  return { key, secret, base: (process.env.MYFATOORAH_BASE_URL || SANDBOX_BASE).replace(/\/+$/, "") };
}

/** Text that is safe to put in a log: one line, short, with anything token-shaped removed. */
export function forLog(value: unknown): string {
  return String(value ?? "")
    .replace(/SK_[A-Za-z0-9_-]{12,}/g, "SK_[removed]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [removed]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

/** One log line per payment event. Never the token, the secret, an email or a card. */
export function logPayment(level: "info" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

async function gateway(config: PaymentsConfig, path: string, init?: { method: string; body: unknown }): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${config.base}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

/** What the gateway said went wrong, shortened for a log. */
function gatewayError(json: unknown): string {
  const body = json as { Message?: unknown; ValidationErrors?: unknown; message?: unknown } | null;
  return forLog(JSON.stringify({ Message: body?.Message ?? body?.message ?? null, ValidationErrors: body?.ValidationErrors ?? null }));
}

/**
 * Asks the gateway for a hosted payment page for one order. The amount is
 * the order's saved total. `orderId` goes along as the gateway's
 * "external identifier", and comes back when we ask about the payment.
 */
export async function createPaymentPage(
  config: PaymentsConfig,
  order: { orderId: string; amountKwd: number | string; returnUrl: string; language: "EN" | "AR" },
): Promise<{ page: CreatedPage } | { error: string; status: number }> {
  const answer = await gateway(config, "/v3/payments", {
    method: "POST",
    body: {
      Order: { Amount: gatewayAmount(order.amountKwd), Currency: "KWD", ExternalIdentifier: order.orderId },
      IntegrationUrls: { Redirection: order.returnUrl },
      Language: order.language,
    },
  });
  const page = readCreatedPage(answer.json);
  return page ? { page } : { error: gatewayError(answer.json), status: answer.status };
}

/** Asks the gateway about one payment. Null when it knows nothing usable about that ID. */
export async function fetchGatewayPayment(config: PaymentsConfig, paymentId: string): Promise<GatewayPayment | null> {
  const id = cleanPaymentId(paymentId);
  if (!id) return null;
  const answer = await gateway(config, `/v3/payments/${encodeURIComponent(id)}`);
  return readGatewayPayment(answer.json);
}

/**
 * The payment IDs the gateway holds for one of our invoices. v3 can only be
 * asked about a payment ID, which normally arrives on the return address.
 * If the customer paid and closed the tab, this is how "Check payment"
 * still finds the payment.
 */
export async function fetchInvoicePaymentIds(config: PaymentsConfig, invoiceId: string): Promise<string[]> {
  const answer = await gateway(config, "/v2/GetPaymentStatus", { method: "POST", body: { Key: invoiceId, KeyType: "InvoiceId" } });
  return readInvoicePaymentIds(answer.json);
}

/**
 * The address the gateway sends the customer back to. The sandbox refuses
 * "localhost" as a return address but accepts 127.0.0.1, so a local run is
 * sent back there (open the local app at http://127.0.0.1:<port>).
 */
export function returnAddress(requestUrl: string, orderId: string): string {
  const origin = new URL(requestUrl);
  if (origin.hostname === "localhost") origin.hostname = "127.0.0.1";
  return `${origin.origin}/orders/${orderId}/payment`;
}

/** A database client with no user: the two server-only functions check the secret themselves. */
export function serverDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Settled = { orderId: string; payment: string; paymentStatus: string; changed: boolean };

/**
 * Hands the gateway's answer to the database, which decides whether it
 * matches the order (settle_payment). Returns null for an invoice we never
 * created. Safe to repeat.
 */
export async function settle(config: PaymentsConfig, fact: GatewayPayment): Promise<Settled | null> {
  const { data, error } = await serverDb().rpc("settle_payment", {
    p_secret: config.secret,
    p_invoice_id: fact.invoiceId,
    p_gateway_payment_id: fact.paymentId,
    p_invoice_status: fact.invoiceStatus,
    p_transaction_status: fact.transactionStatus,
    p_amount: fact.amount,
    p_currency: fact.currency,
    p_external_identifier: fact.externalIdentifier,
  });
  if (error) {
    if (error.message === "unknown_invoice") return null;
    throw new Error(error.message);
  }
  const row = data as { order_id: string; payment: string; payment_status: string; changed: boolean };
  return { orderId: row.order_id, payment: row.payment, paymentStatus: row.payment_status, changed: row.changed };
}

/** Turns what the database decided into what the customer is told. */
export function outcomeOf(settled: Settled): PaymentOutcome {
  if (settled.paymentStatus === "refund_due") return "refund_due";
  if (settled.paymentStatus === "paid") return "paid";
  if (settled.payment === "failed") return "failed";
  if (settled.payment === "cancelled") return "cancelled";
  if (settled.payment === "mismatch") return "mismatch";
  return "awaiting";
}
