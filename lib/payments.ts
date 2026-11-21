// The parts of online payment that need no network or database, so they
// can be unit-tested: reading the gateway's answers, and deciding what a
// ticket should say about payment.
//
// The gateway is MyFatoorah's v3 API in sandbox (test) mode. Nothing here
// decides that an order is paid. That is settle_payment in the database,
// which compares the gateway's answer with the saved order.

/** MyFatoorah's test server. No real money moves here. */
export const SANDBOX_BASE = "https://apitest.myfatoorah.com";

export type PaymentMethod = "pay_at_pickup" | "online";

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "pay_at_pickup" || value === "online";
}

/** The amount sent to the gateway: the saved order total, as a number with at most 3 decimals. */
export function gatewayAmount(totalKwd: number | string): number {
  return Number(Number(totalKwd).toFixed(3));
}

/** A payment ID as the gateway puts it on the return address. Anything else is not sent anywhere. */
export function cleanPaymentId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(value) ? value : null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;

const isTrue = (value: unknown) => value === true || value === "true" || value === "True";

/**
 * Reads the payment IDs out of the gateway's invoice status answer
 * (POST /v2/GetPaymentStatus with KeyType "InvoiceId"). Used when the
 * customer paid but never came back with a payment ID on the address.
 * Only the IDs are taken from it; each one is then asked about properly.
 */
export function readInvoicePaymentIds(json: unknown): string[] {
  const body = json as { IsSuccess?: unknown; Data?: { InvoiceTransactions?: unknown } } | null;
  if (!body || !isTrue(body.IsSuccess) || !Array.isArray(body.Data?.InvoiceTransactions)) return [];
  const ids = new Set<string>();
  for (const row of body.Data.InvoiceTransactions as { PaymentId?: unknown }[]) {
    const id = cleanPaymentId(text(row?.PaymentId));
    if (id) ids.add(id);
  }
  return [...ids];
}

/** What "create payment" must give back before the customer is sent anywhere. */
export type CreatedPage = { invoiceId: string; paymentUrl: string };

/** Reads the answer to POST /v3/payments. Null unless it holds an invoice ID and an https payment page. */
export function readCreatedPage(json: unknown): CreatedPage | null {
  const body = json as { IsSuccess?: unknown; Data?: { InvoiceId?: unknown; PaymentURL?: unknown; PaymentUrl?: unknown } } | null;
  if (!body || !isTrue(body.IsSuccess) || !body.Data) return null;
  const invoiceId = text(body.Data.InvoiceId);
  const paymentUrl = text(body.Data.PaymentURL ?? body.Data.PaymentUrl);
  if (!invoiceId || !paymentUrl || !/^https:\/\//i.test(paymentUrl)) return null;
  return { invoiceId, paymentUrl };
}

/** What the gateway says about one payment. Passed to the database as it is. */
export type GatewayPayment = {
  invoiceId: string;
  paymentId: string | null;
  invoiceStatus: string | null;
  transactionStatus: string | null;
  amount: number | null;
  currency: string | null;
  /** The reference we gave the gateway when the page was made: our order's ID. */
  externalIdentifier: string | null;
};

/** Reads the answer to GET /v3/payments/{paymentId}. Null unless it names an invoice. */
export function readGatewayPayment(json: unknown): GatewayPayment | null {
  const body = json as {
    IsSuccess?: unknown;
    Data?: {
      Invoice?: { Id?: unknown; Status?: unknown; ExternalIdentifier?: unknown };
      Transaction?: { Status?: unknown; PaymentId?: unknown; Id?: unknown };
      Amount?: { ValueInBaseCurrency?: unknown; BaseCurrency?: unknown };
    };
  } | null;
  if (!body || !isTrue(body.IsSuccess) || !body.Data?.Invoice) return null;
  const invoiceId = text(body.Data.Invoice.Id);
  if (!invoiceId) return null;
  const value = body.Data.Amount?.ValueInBaseCurrency;
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return {
    invoiceId,
    paymentId: text(body.Data.Transaction?.PaymentId),
    invoiceStatus: text(body.Data.Invoice.Status),
    transactionStatus: text(body.Data.Transaction?.Status),
    amount: Number.isFinite(amount) ? amount : null,
    currency: text(body.Data.Amount?.BaseCurrency),
    externalIdentifier: text(body.Data.Invoice.ExternalIdentifier),
  };
}

/**
 * What a ticket, the kitchen board and the manager's list say about money:
 * - pickup:      pay at the counter
 * - paid:        paid online, confirmed
 * - awaiting:    chose to pay online; not confirmed yet
 * - refund_due:  paid online, then rejected or cancelled
 */
export type PaymentView = "pickup" | "paid" | "awaiting" | "refund_due";

export function paymentView(order: { payment_method: string; payment_status?: string | null }): PaymentView {
  if (order.payment_status === "refund_due") return "refund_due";
  if (order.payment_status === "paid") return "paid";
  return order.payment_method === "online" ? "awaiting" : "pickup";
}

/** The kitchen only starts on an online order once it is paid. */
export function canAccept(order: { payment_method: string; payment_status?: string | null }): boolean {
  return paymentView(order) !== "awaiting";
}

/** A customer can pay (or pay again) while an online order is unpaid and still alive. */
export function canPayNow(order: { payment_method: string; payment_status?: string | null; status: string }): boolean {
  return paymentView(order) === "awaiting" && order.status !== "rejected" && order.status !== "cancelled";
}

/** What the payment screen shows after asking the server. */
export type PaymentOutcome =
  /** Confirmed and matching. */
  | "paid"
  /** The gateway says it failed. */
  | "failed"
  /** The gateway says it was cancelled. */
  | "cancelled"
  /** No final answer yet. */
  | "awaiting"
  /** The gateway says paid, but it does not match this order. Not marked paid. */
  | "mismatch"
  /** Paid, and the order had already been rejected or cancelled. */
  | "refund_due"
  /** Nothing for this order could be found at the gateway. */
  | "nothing"
  /** Not signed in as this order's customer, or no such order. */
  | "not_found"
  /** Payments are not set up, or the gateway could not be reached. */
  | "unavailable";

/**
 * What the ticket's summary says about money, in one word.
 *
 * - nothing_to_pay: the order was cancelled or rejected before any money
 *   moved. There is nothing to pay, so no payment reminder is shown.
 * - refund_due:     it was paid online and then cancelled or rejected.
 * - paid:           paid online, confirmed by the server with the gateway.
 * - due_at_pickup:  to be paid at the truck's counter.
 * - online_unpaid:  to be paid online, not paid yet.
 */
export type MoneyLine = "nothing_to_pay" | "refund_due" | "paid" | "due_at_pickup" | "online_unpaid";

export function moneyLine(order: { status: string; payment_method: string; payment_status: string }): MoneyLine {
  if (order.payment_status === "refund_due") return "refund_due";
  const over = order.status === "cancelled" || order.status === "rejected";
  if (over && order.payment_status !== "paid") return "nothing_to_pay";
  if (order.payment_status === "paid") return "paid";
  return order.payment_method === "online" ? "online_unpaid" : "due_at_pickup";
}
