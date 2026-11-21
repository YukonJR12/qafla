"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { KitchenTicket, StatusChip } from "@/components/kitchen-ticket";
import { LanguageSwitch } from "@/components/language-switch";
import { OperatingSwitch } from "@/components/operating-switch";
import { Isolate, PickupSticker, primaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchKitchenOrders, fetchMyTruck, fetchTruckState, type Truck, type TruckState } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { groupBySlot, needsCooking, type KitchenOrder } from "@/lib/kitchen";
import { useLocale } from "@/lib/locale";
import { paymentView } from "@/lib/payments";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";
import { useLiveOrders } from "@/lib/use-live-orders";
import { useSession } from "@/lib/use-session";
import { operating } from "@/lib/vendor-edits";

// The vendor's kitchen board: tonight's tickets for the signed-in vendor's
// own truck, grouped by pickup time, earliest first.
//
// Which truck that is comes from the database (trucks.vendor_id), never from
// the address bar. Row-level security hands this account its own truck's
// orders and nobody else's.
//
// The header also carries the vendor's own "Taking orders" switch. Switching
// it off, or the park manager closing the truck for tonight, stops NEW
// orders only: every ticket already here stays, with its buttons, to finish.
export default function VendorBoardPage() {
  const { locale, t } = useLocale();
  const { loading: sessionLoading, session } = useSession();
  const { signOut } = useAccount();
  const userId = session?.user.id ?? null;

  // Step 1: which truck does this account run?
  const [mine, setMine] = useState<{ userId: string; truck: Truck | null; failed: boolean } | null>(null);
  const [truckTry, setTruckTry] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchMyTruck(supabaseBrowser(), userId).then(
      (truck) => current && setMine({ userId, truck, failed: false }),
      () => current && setMine({ userId, truck: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [userId, truckTry]);
  const account = mine?.userId === userId ? mine : null; // never show another account's truck
  const truck = account?.truck ?? null;
  const truckId = truck?.id ?? null;

  // Step 2: tonight's tickets for that truck.
  const [board, setBoard] = useState<{ truckId: string; orders: KitchenOrder[]; state: TruckState } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const readNumber = useRef(0); // so an older, slower read never overwrites a newer one

  const reread = useCallback(async () => {
    if (!truckId) return;
    const mineNumber = ++readNumber.current;
    const db = supabaseBrowser();
    try {
      const [orders, state] = await Promise.all([fetchKitchenOrders(db, truckId), fetchTruckState(db, truckId)]);
      if (mineNumber !== readNumber.current) return;
      setBoard({ truckId, orders, state });
      setLoadFailed(false);
    } catch (error) {
      if (mineNumber === readNumber.current) setLoadFailed(true);
      throw error;
    }
  }, [truckId]);

  // The first read does not wait for the live connection.
  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  // Coming back to this tab re-reads too. The park manager's closure is not
  // an order, so no live nudge announces it; this picks it up.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reread().catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reread]);

  // New orders and status changes arrive as nudges; each one re-reads the board.
  const live = useLiveOrders({
    enabled: truckId !== null,
    channel: `kitchen-${truckId}`,
    filter: `truck_id=eq.${truckId}`,
    reread,
  });

  const shown = board && board.truckId === truckId ? board : null;
  const { groups, finished } = groupBySlot(shown?.orders ?? []);
  const toCook = (shown?.orders ?? []).filter((order) => needsCooking(order.status)).length;
  const active = groups.reduce((n, group) => n + group.orders.length, 0);
  const mode = shown ? operating(shown.state) : null;

  // The database saved the switch: show it at once, then read everything again.
  function switched(isOpen: boolean) {
    readNumber.current++;
    setBoard((was) => was && { ...was, state: { ...was.state, isOpen } });
    reread().catch(() => {});
  }

  // The database answered an action: show exactly the status it saved.
  function confirmed(saved: { id: string; status: string; rejection_reason: string | null }) {
    readNumber.current++; // drop any read that started before this answer
    setBoard(
      (was) =>
        was && {
          ...was,
          orders: was.orders.map((order) =>
            order.id === saved.id ? { ...order, status: saved.status, rejection_reason: saved.rejection_reason } : order,
          ),
        },
    );
    reread().catch(() => {});
  }

  const signedOut = !sessionLoading && !session;
  const name = truck ? truckName(truck, locale) : t.kitchenBoard;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-divider bg-snowy-white">
        <div className="mx-auto max-w-[1440px] px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted">
                {t.appName} · {t.kitchenBoard}
              </p>
              <h1 className="text-xl leading-tight font-extrabold text-balance">{name}</h1>
            </div>
            <LanguageSwitch />
          </div>
          {truck && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {/* The vendor's own switch. Locked while the park manager's closure is in force. */}
              {shown && <OperatingSwitch truckId={truck.id} state={shown.state} onSaved={switched} />}
              {/* If the live connection drops, the last known tickets stay and this says so. */}
              <span role="status" className="inline-flex items-center gap-1.5 font-semibold text-muted">
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${live === "live" ? "border border-ink bg-yellow-punk" : "bg-outline"}`}
                />
                {live === "live" ? t.live : live === "reconnecting" ? t.reconnecting : t.loading}
              </span>
              {/* One number for the whole truck. Changing it is its own screen. */}
              <Link href="/vendor/capacity" className="inline-flex min-h-11 items-center gap-1.5 font-semibold">
                <span>{t.capacityNow(truck.slot_capacity)}</span>
                <span className="font-bold underline underline-offset-4">{t.change}</span>
              </Link>
              <Link href="/vendor/truck" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                {t.editDetails}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="ms-auto min-h-11 font-bold underline underline-offset-4"
              >
                {t.signOut}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pt-4 pb-10 md:px-6">
        {sessionLoading || (userId && !account) ? (
          <p className="min-h-96 text-muted" aria-live="polite">
            {t.loading}
          </p>
        ) : signedOut ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.vendorSignInTitle}</h2>
            <p className="mt-2 text-muted">{t.vendorSignInBody}</p>
            <Link href="/sign-in?next=/vendor" className={`${primaryButton} mt-6`}>
              {t.signIn}
            </Link>
          </div>
        ) : account?.failed ? (
          <LoadError title={t.boardLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => setTruckTry((n) => n + 1)} />
        ) : !truck ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.notVendorTitle}</h2>
            <p className="mt-2 text-muted">{t.notVendorBody}</p>
            <button type="button" onClick={() => signOut()} className={`${primaryButton} mt-6`}>
              {t.signOut}
            </button>
          </div>
        ) : !shown ? (
          loadFailed ? (
            <LoadError title={t.boardLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => reread().catch(() => {})} />
          ) : (
            <div role="status" aria-label={t.loading} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-56 rounded-panel bg-subtle" />
              <div className="h-56 rounded-panel bg-subtle" />
            </div>
          )
        ) : (
          <>
            {/* Closed to new orders, but tonight's existing tickets still get finished. */}
            {/* Who closed it is said in words: the two closures are not the same thing. */}
            {mode !== "open" && (
              <p className="mb-4 rounded-control bg-warning-surface p-3 text-warning">
                <span className="font-extrabold">{mode === "park" ? t.parkClosedLabel : t.pausedLabel}</span>
                <span className="block text-sm">
                  {mode === "park" ? t.parkClosedBody : t.pausedBody} {t.closedStillActive(active)}
                </span>
              </p>
            )}

            {groups.length === 0 ? (
              <div className="pt-10 text-center">
                <h2 className="text-2xl font-extrabold">{finished.length === 0 ? t.noOrdersYet : t.nothingToCook}</h2>
                <p className="mt-2 text-muted">{finished.length === 0 ? t.noOrdersBody : t.nothingToCookBody}</p>
              </div>
            ) : (
              <>
                {/* The glance line: when the next pickup is, and how much is left to cook. */}
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-panel bg-ink px-4 py-3 text-snowy-white">
                  <p>
                    <span className="block text-sm font-semibold">{t.nextPickupDue}</span>
                    <Isolate className="text-3xl leading-tight font-extrabold">{formatSlot(groups[0].slot, locale)}</Isolate>
                  </p>
                  <p className="text-lg font-extrabold text-yellow-punk tabular-nums">{t.toCook(toCook)}</p>
                </div>

                {groups.map((group, index) => {
                  const time = formatSlot(group.slot, locale);
                  const fullSlot = group.booked >= truck.slot_capacity;
                  return (
                    <section key={group.slot} aria-labelledby={`slot-${group.slot}`} className="mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-divider pb-2">
                        <h2 id={`slot-${group.slot}`} className="text-lg font-extrabold">
                          {index === 0 ? (
                            <PickupSticker>
                              <Isolate>{time}</Isolate> · {t.dueNext}
                            </PickupSticker>
                          ) : (
                            <Isolate>{time}</Isolate>
                          )}
                        </h2>
                        <p className="text-sm text-muted">
                          {t.orderCount(group.orders.length)} ·{" "}
                          <span className="font-bold text-ink" aria-label={t.slotPlacesLabel(group.booked, truck.slot_capacity)}>
                            <Isolate>{t.slotPlaces(group.booked, truck.slot_capacity)}</Isolate>
                            {fullSlot && ` · ${t.full}`}
                          </span>
                        </p>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {group.orders.map((order) => (
                          <KitchenTicket
                            key={order.id}
                            order={order}
                            onConfirmed={confirmed}
                            onStale={() => reread().catch(() => {})}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </>
            )}

            {finished.length > 0 && (
              <details className="mt-8 border-t border-divider pt-3">
                <summary className="min-h-11 cursor-pointer py-2 font-bold">{t.finishedTonight(finished.length)}</summary>
                <ul className="divide-y divide-divider">
                  {finished.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <Isolate className="font-bold">{formatSlot(order.slot_start, locale)}</Isolate>
                      <Isolate className="text-muted">{order.ticket_ref}</Isolate>
                      <StatusChip status={order.status} />
                      {/* A finished order that was paid online: say whether money is owed back. */}
                      {paymentView(order) === "refund_due" && (
                        <span className="rounded-control bg-warning-surface px-2 py-0.5 text-sm font-bold text-warning">{t.paymentLabel.refund_due}</span>
                      )}
                      {paymentView(order) === "paid" && (
                        <span className="rounded-control bg-ink px-2 py-0.5 text-sm font-bold text-snowy-white">{t.paymentLabel.paid}</span>
                      )}
                      {order.rejection_reason && <span className="basis-full text-sm text-muted">{order.rejection_reason}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}
