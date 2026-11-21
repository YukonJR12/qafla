"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PickupTimeline } from "@/components/pickup-timeline";
import { TicketCard } from "@/components/ticket-card";
import { CancelOrder, OrderRating } from "@/components/ticket-actions";
import { CheckIcon, Isolate, Money, primaryButton, secondaryButton, XIcon } from "@/components/ui";
import { fetchOrder, type Order } from "@/lib/data";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { dishPhoto } from "@/lib/images";
import { canPayNow, moneyLine } from "@/lib/payments";
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
  // `opened` is the status the ticket had when this screen first read it.
  // It tells "became ready while I was watching" from "was already ready".
  const [state, setState] = useState<{ loaded: boolean; order: Order | null; opened?: string }>({ loaded: false, order: null });
  const [checking, setChecking] = useState(false);
  // What happened when the customer tried to cancel, said once in words.
  const [cancelNote, setCancelNote] = useState<"cancelled" | "too_late" | null>(null);

  const readNumber = useRef(0); // so an older, slower read never overwrites a newer one

  // Reads the saved order again. If the read fails, what is on screen stays.
  const reread = useCallback(async () => {
    const mine = ++readNumber.current;
    const order = await fetchOrder(supabaseBrowser(), id);
    if (mine === readNumber.current) setState((was) => ({ loaded: true, order, opened: was.opened ?? order?.status }));
  }, [id]);

  const userId = session?.user.id;
  useEffect(() => {
    if (sessionLoading) return;
    // Only the very first read may conclude "not found"; later failures keep the ticket.
    reread().catch(() => setState((was) => (was.loaded ? was : { loaded: true, order: null })));
  }, [sessionLoading, userId, reread]);

  const { loaded, order } = state;
  const truck = order?.trucks ?? { id: order?.truck_id ?? "", name: "" };
  const money = order ? moneyLine(order) : "due_at_pickup";

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
                // Drawn attention to once, and only when it turns ready while the ticket
                // is open. Reopening a ready ticket shows the notice already in place.
                <p
                  className={`mb-4 flex items-center gap-3 rounded-control border border-ink bg-yellow-punk p-3 ${
                    state.opened !== "ready" ? "ready-arrive" : ""
                  }`}
                >
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

            {/* The black ticket: truck, status, the pickup time above all, and the reference on the stub. */}
            <TicketCard truck={truck} slot={order.slot_start} status={order.status}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-bold">
                <span>{t.orderRef}</span>
                <Isolate className="text-lg">{order.ticket_ref}</Isolate>
              </p>
            </TicketCard>

            {/* Where the order is now: five labelled stages, or its final state. */}
            <section aria-labelledby="progress-title" className="mt-6">
              <h2 id="progress-title" className="text-xl font-extrabold">
                {t.orderProgress}
              </h2>
              <div className="mt-3">
                <PickupTimeline status={order.status} truck={truckName(truck, locale)} announce={order.status !== "ready"} />
                {/* A cancelled or rejected order ends here, with its own message and no stages. */}
                {order.status === "cancelled" && (
                  <div className="flex items-start gap-3 rounded-panel border border-ink p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-snowy-white">
                      <XIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-lg leading-snug font-extrabold">{t.cancelledTitle}</p>
                      <p className="mt-1 text-sm text-muted">
                        {(money === "refund_due" ? t.cancelledBodyPaid : t.cancelledBody)(formatSlot(order.slot_start, locale))}
                      </p>
                    </div>
                  </div>
                )}
                {order.status === "rejected" && (
                  <div className="flex items-start gap-3 rounded-panel bg-error-surface p-4 text-error">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error text-snowy-white">
                      <XIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-lg leading-snug font-extrabold">{t.rejectedTitle(truckName(truck, locale))}</p>
                      {order.rejection_reason && (
                        <p className="mt-1 text-sm">
                          <span className="font-semibold">{t.rejectedReason}</span> <span className="wrap-anywhere">{order.rejection_reason}</span>
                        </p>
                      )}
                      <p className="mt-1 text-sm">{money === "refund_due" ? t.rejectedBodyPaid : t.rejectedBody}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* What was ordered, at the prices saved with the order. */}
            <section aria-labelledby="details-title" className="mt-6">
              <h2 id="details-title" className="text-xl font-extrabold">
                {t.orderDetails}
              </h2>
              <ul className="mt-2 divide-y divide-divider border-b border-divider">
                {order.order_items.map((line) => {
                  const photo = dishPhoto(line.item_id);
                  return (
                    <li key={line.item_id} className="flex items-center gap-3 py-2.5">
                      {photo && (
                        <Image
                          src={photo}
                          alt=""
                          width={480}
                          height={480}
                          sizes="80px"
                          className="h-14 w-20 shrink-0 rounded-control object-cover outline outline-1 -outline-offset-1 outline-black/10"
                        />
                      )}
                      <span className="min-w-0 flex-1 leading-snug font-bold">
                        <Isolate>{line.quantity} ×</Isolate> {itemName({ id: line.item_id, name: line.item_name }, locale)}
                      </span>
                      <Money amount={Number(line.unit_price_kwd) * line.quantity} locale={locale} className="font-bold" />
                    </li>
                  );
                })}
              </ul>

              {/* One line about money, from the order's real payment state. */}
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl leading-snug font-extrabold">{t.moneyLine[money].title}</p>
                  {/* Re-keyed by the payment state, so a live change gives it a short bump. */}
                  <p key={order.payment_status} className="bump text-sm text-muted">
                    {t.moneyLine[money].note}
                  </p>
                </div>
                {/* The total the server saved with the order. Struck through when nothing is owed. */}
                <Money
                  amount={order.total_kwd}
                  locale={locale}
                  className={`text-2xl font-extrabold ${money === "nothing_to_pay" ? "text-muted line-through" : ""}`}
                />
              </div>
              {money === "refund_due" && <p className="mt-1 text-sm text-muted">{t.refundDueBody}</p>}
            </section>

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
