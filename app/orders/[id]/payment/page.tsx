"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CheckIcon, Isolate, Money, primaryButton, secondaryButton } from "@/components/ui";
import { fetchOrder, type Order } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { startPayment, verifyPayment } from "@/lib/pay-client";
import { canPayNow, cleanPaymentId, type PaymentOutcome } from "@/lib/payments";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";

// The payment screen for one order. It is where checkout sends a customer
// who chose "Pay online", and where the gateway sends them back.
//
//   /orders/<id>/payment?start=1        go to the gateway's payment page
//   /orders/<id>/payment?paymentId=...  the gateway's return: what happened?
//   /orders/<id>/payment                the same question, asked again
//
// This screen decides nothing. It asks our server, the server asks the
// gateway, and the database marks the order paid only if the payment
// matches it. Whatever is typed into the address, reloading this page or
// opening it for an order that was never paid shows "not paid".
export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLocale();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<{ phase: "starting" | "confirming" } | { phase: "done"; outcome: PaymentOutcome; reference: string | null }>({
    phase: "confirming",
  });
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  const refreshOrder = useCallback(async () => {
    const fresh = await fetchOrder(supabaseBrowser(), id).catch(() => null);
    if (fresh) setOrder(fresh);
    return fresh;
  }, [id]);

  /** Sends the customer to the gateway's page for this order. */
  const pay = useCallback(async () => {
    setBusy(true);
    setState({ phase: "starting" });
    const started = await startPayment(id, locale);
    if ("url" in started) {
      window.location.assign(started.url); // leaves this app for the gateway's page
      return;
    }
    await refreshOrder();
    setState({ phase: "done", outcome: started.outcome, reference: started.reference });
    setBusy(false);
  }, [id, locale, refreshOrder]);

  /** Asks the server what happened. Repeating it changes nothing. */
  const check = useCallback(
    async (paymentId: string | null) => {
      setBusy(true);
      setState({ phase: "confirming" });
      const result = await verifyPayment(id, paymentId);
      await refreshOrder();
      setState({ phase: "done", outcome: result.outcome, reference: result.reference });
      setBusy(false);
    },
    [id, refreshOrder],
  );

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const query = new URLSearchParams(window.location.search);
    const paymentId = cleanPaymentId(query.get("paymentId"));
    const starting = query.get("start") === "1" && !paymentId;
    // Take "start" off the address first, so Back or a reload asks "what
    // happened?" instead of opening the payment page again.
    if (starting) window.history.replaceState(null, "", window.location.pathname);
    // Run after this render has finished, as its own step.
    setTimeout(() => void (starting ? pay() : check(paymentId)), 0);
  }, [pay, check]);

  const ref = order?.ticket_ref ?? "";
  const done = state.phase === "done" ? state : null;
  const words = done ? (t.paymentOutcome[done.outcome] ?? t.paymentOutcome.unavailable) : null;
  const good = done?.outcome === "paid";
  const payable = order ? canPayNow(order) : false;

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.paymentScreenTitle} backHref={`/orders/${id}`} backLabel={t.openTicket} />

      <main className="mx-auto max-w-xl px-4 pt-4 pb-10 md:px-6">
        {/* The order this payment is for, read from the database. */}
        {order && (
          <section className="rounded-panel border border-ink p-4">
            <p className="text-sm font-semibold text-muted">
              <Isolate>{order.ticket_ref}</Isolate> · {truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)} ·{" "}
              <Isolate>{formatSlot(order.slot_start, locale)}</Isolate>
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="font-bold">{t.totalPlain}</p>
              <Money amount={order.total_kwd} locale={locale} className="text-2xl font-extrabold" />
            </div>
            <p className="mt-1 text-sm font-semibold">{t.paymentLabel[order.payment_status === "paid" ? "paid" : order.payment_status === "refund_due" ? "refund_due" : order.payment_method === "online" ? "awaiting" : "pickup"]}</p>
          </section>
        )}

        <div role="status" className="mt-5">
          {!done ? (
            <p className="min-h-24 text-lg font-bold" aria-busy>
              {state.phase === "starting" ? t.paymentStarting : t.paymentConfirming}
            </p>
          ) : (
            <div
              className={`reveal-up rounded-panel p-4 ${
                good
                  ? "border border-ink bg-yellow-punk"
                  : done.outcome === "awaiting" || done.outcome === "refund_due"
                    ? "bg-warning-surface text-warning"
                    : "bg-error-surface text-error"
              }`}
            >
              <h2 className="flex items-start gap-2 text-xl leading-snug font-extrabold">
                {good && <CheckIcon className="mt-0.5 size-6" />}
                {words!.title}
              </h2>
              <p className="mt-1">{words!.body(ref)}</p>
              {done.reference && !good && (
                <p className="mt-1 text-sm">
                  <bdi className="tabular-nums">{t.errorReference(done.reference)}</bdi>
                </p>
              )}
            </div>
          )}
        </div>

        {done && (
          <div className="mt-5 space-y-2">
            {payable && done.outcome !== "awaiting" && (
              <button type="button" onClick={pay} disabled={busy} className={primaryButton}>
                {t.payNow}
              </button>
            )}
            {payable && (
              <button type="button" onClick={() => check(null)} disabled={busy} className={done.outcome === "awaiting" ? primaryButton : secondaryButton}>
                {t.checkPayment}
              </button>
            )}
            {done.outcome !== "not_found" ? (
              <Link href={`/orders/${id}`} className={payable ? secondaryButton : primaryButton}>
                {t.openTicket}
              </Link>
            ) : (
              <Link href="/orders" className={primaryButton}>
                {t.myOrders}
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
