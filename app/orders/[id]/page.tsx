"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PickupTimeline } from "@/components/pickup-timeline";
import { CancelOrder, OrderRating } from "@/components/ticket-actions";
import { CheckIcon, Isolate, Money, primaryButton, secondaryButton } from "@/components/ui";
import { fetchOrder, type Order } from "@/lib/data";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { canPayNow, paymentView } from "@/lib/payments";
import { canCancel } from "@/lib/ticket";
import { formatSlot } from "@/lib/time";
import { useLiveOrders } from "@/lib/use-live-orders";
import { useSession } from "@/lib/use-session";

// The confirmed order ticket. Everything on it is read back from the
// database by the order's ID, so refreshing shows the same saved order and
// never places another one.
//
// While the ticket is open it listens for changes to this one order. When
// the truck moves it (for example to "ready"), the page re-reads the saved
// order and shows the new status without the customer tapping anything.
//
// The timeline, "Cancel order" and the rating all follow the confirmed
// status: cancelling is offered only while the order is placed, and rating
// only once it is collected. The database enforces both.
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLocale();
  const { loading: sessionLoading, session } = useSession();
  const [state, setState] = useState<{ loaded: boolean; order: Order | null }>({ loaded: false, order: null });
  const [checking, setChecking] = useState(false);
  // What happened when the customer tried to cancel, said once in words.
  const [cancelNote, setCancelNote] = useState<"cancelled" | "too_late" | null>(null);

  const readNumber = useRef(0); // so an older, slower read never overwrites a newer one

  // Reads the saved order again. If the read fails, what is on screen stays.
  const reread = useCallback(async () => {
    const mine = ++readNumber.current;
    const order = await fetchOrder(supabaseBrowser(), id);
    if (mine === readNumber.current) setState({ loaded: true, order });
  }, [id]);

  const userId = session?.user.id;
  useEffect(() => {
    if (sessionLoading) return;
    // Only the very first read may conclude "not found"; later failures keep the ticket.
    reread().catch(() => setState((was) => (was.loaded ? was : { loaded: true, order: null })));
  }, [sessionLoading, userId, reread]);

  const { loaded, order } = state;

  // Live updates for this one order, plus a fresh read on reconnect and on
  // returning to the tab, so a missed change cannot leave the ticket stale.
  const live = useLiveOrders({
    enabled: !sessionLoading && Boolean(userId) && order !== null,
    channel: `ticket-${id}`,
    filter: `id=eq.${id}`,
    reread,
  });

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.yourOrder} backHref="/orders" backLabel={t.backToOrders} />

      <main className="mx-auto max-w-xl px-4 pt-4 pb-10 md:px-6">
        {!loaded ? (
          <p className="min-h-96 text-muted" aria-live="polite">
            {t.loading}
          </p>
        ) : !order ? (
          <div className="pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.orderNotFound}</h2>
            {/* Someone is always signed in here, so this order belongs to another account (or does not exist). */}
            <p className="mt-2 text-muted">{t.orderNotYoursBody}</p>
            <Link href="/orders" className={`${primaryButton} mt-6`}>
              {t.myOrders}
            </Link>
          </div>
        ) : (
          <>
            {/*
              A persistent Yellow Punk notice for as long as the order is ready.
              The wrapper is always on the page, so a screen reader announces
              the notice once, at the moment it appears inside it.
            */}
            <div role="status">
              {order.status === "ready" && (
                <p className="reveal-up mb-4 flex items-center gap-3 rounded-control border border-ink bg-yellow-punk p-3">
                  <CheckIcon className="size-7" />
                  <span className="min-w-0">
                    <span className="block text-lg leading-snug font-extrabold">{t.statusHelp.ready}</span>
                    <span className="block text-sm font-semibold">
                      {t.readyCounter(truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale))}
                    </span>
                  </span>
                </p>
              )}
            </div>

            <article className="rounded-panel border border-ink p-6">
              {/* Lead with the confirmed time and the truck. */}
              <p className="text-sm font-semibold text-muted">{t.pickUpAt}</p>
              <p className="text-5xl leading-none font-extrabold tracking-tight">
                <Isolate>{formatSlot(order.slot_start, locale)}</Isolate>
              </p>
              <p className="mt-2 text-2xl leading-tight font-extrabold">
                {truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)}
              </p>

              {/* Directly below the time and the truck: where the order is now. */}
              <PickupTimeline
                status={order.status}
                truck={truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)}
                announce={order.status !== "ready"}
              />
              {/* A cancelled or rejected order ends here, with its own message. */}
              {order.status === "cancelled" && (
                <div className="mt-5 rounded-control bg-subtle p-3">
                  <p className="font-extrabold">{t.cancelledTitle}</p>
                  <p className="mt-1 text-sm text-muted">{(paymentView(order) === "refund_due" ? t.cancelledBodyPaid : t.cancelledBody)(formatSlot(order.slot_start, locale))}</p>
                </div>
              )}
              {order.status === "rejected" && (
                <div className="mt-5 rounded-control bg-error-surface p-3 text-error">
                  <p className="font-extrabold">
                    {t.rejectedTitle(truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale))}
                  </p>
                  {order.rejection_reason && (
                    <p className="mt-1 text-sm">
                      <span className="font-semibold">{t.rejectedReason}</span> <span className="wrap-anywhere">{order.rejection_reason}</span>
                    </p>
                  )}
                  <p className="mt-1 text-sm">{paymentView(order) === "refund_due" ? t.rejectedBodyPaid : t.rejectedBody}</p>
                </div>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-dashed border-outline pt-4">
                <dt className="text-sm font-semibold text-muted">{t.orderRef}</dt>
                <dt className="text-sm font-semibold text-muted">{t.status}</dt>
                <dd className="text-lg font-bold">
                  <Isolate>{order.ticket_ref}</Isolate>
                </dd>
                {/* The timeline's caption and the ready notice announce changes; this is the plain label. */}
                <dd className="text-lg font-bold">{t.statusName[order.status] ?? order.status}</dd>
              </dl>

              <ul className="mt-4 space-y-1.5 border-t border-divider pt-4">
                {order.order_items.map((line) => (
                  <li key={line.item_id} className="flex items-baseline justify-between gap-3">
                    <span>
                      <Isolate className="font-bold">{line.quantity} ×</Isolate>{" "}
                      {itemName({ id: line.item_id, name: line.item_name }, locale)}
                    </span>
                    <Money amount={Number(line.unit_price_kwd) * line.quantity} locale={locale} className="font-semibold" />
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-divider pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">{paymentView(order) === "pickup" ? t.totalAtCounter : t.totalPlain}</p>
                  {/* The total the server saved with the order. */}
                  <Money amount={order.total_kwd} locale={locale} className="text-2xl font-extrabold" />
                </div>
                {/* Payment has its own line and its own words; it is not a kitchen status. */}
                <p
                  key={order.payment_status}
                  className={`bump mt-2 inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-sm font-bold ${
                    paymentView(order) === "paid"
                      ? "bg-ink text-snowy-white"
                      : paymentView(order) === "refund_due"
                        ? "bg-warning-surface text-warning"
                        : "bg-subtle text-ink"
                  }`}
                >
                  {paymentView(order) === "paid" && <CheckIcon className="size-4" />}
                  {t.paymentLabel[paymentView(order)]}
                </p>
                {paymentView(order) === "refund_due" && <p className="mt-1 text-sm text-muted">{t.refundDueBody}</p>}
              </div>
            </article>

            {/* An online order that is not paid yet: say so plainly, and offer the way to pay. */}
            {canPayNow(order) && (
              <section className="mt-4 rounded-panel bg-warning-surface p-4 text-warning">
                <h2 className="font-extrabold">{t.unpaidOnlineTitle}</h2>
                <p className="mt-1 text-sm">
                  {t.unpaidOnlineBody(formatSlot(order.slot_start, locale), truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale))}
                </p>
                <Link href={`/orders/${order.id}/payment?start=1`} className={`${primaryButton} mt-3`}>
                  {t.payNow}
                </Link>
                <Link href={`/orders/${order.id}/payment`} className={`${secondaryButton} mt-2`}>
                  {t.checkPayment}
                </Link>
              </section>
            )}

            {/* Once collected, the customer can rate this order, one time. */}
            {order.status === "collected" && <OrderRating orderId={order.id} />}

            <div className="mt-4 space-y-2">
              <p role="status">
                {cancelNote && (
                  <span
                    className={`block rounded-control p-3 font-semibold ${
                      cancelNote === "cancelled" ? "bg-ink text-snowy-white" : "bg-warning-surface text-warning"
                    }`}
                  >
                    {cancelNote === "cancelled"
                      ? t.cancelDone
                      : t.cancelTooLate(
                          truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale),
                          t.statusName[order.status] ?? order.status,
                        )}
                  </span>
                )}
              </p>
              {canCancel(order.status) && (
                <CancelOrder
                  order={order}
                  time={formatSlot(order.slot_start, locale)}
                  truck={truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)}
                  onCancelled={(saved) => {
                    // Show exactly the status the database saved, then re-read.
                    readNumber.current++;
                    setState((was) => (was.order ? { ...was, order: { ...was.order, status: saved.status } } : was));
                    setCancelNote("cancelled");
                    reread().catch(() => {});
                  }}
                  onTooLate={async () => {
                    // The truck got there first. Read what was saved, then say so.
                    await reread().catch(() => {});
                    setCancelNote("too_late");
                  }}
                />
              )}
              <button
                type="button"
                disabled={checking}
                aria-busy={checking}
                className={secondaryButton}
                onClick={async () => {
                  setChecking(true);
                  await reread().catch(() => {});
                  setChecking(false);
                }}
              >
                {checking ? t.loading : t.checkStatus}
              </button>
              {/* The last known status stays on screen while the connection comes back. */}
              {live === "reconnecting" && (
                <p role="status" className="text-center text-sm font-semibold text-muted">
                  {t.reconnecting}
                </p>
              )}
              <Link href="/orders" className={primaryButton}>
                {t.backToOrders}
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
