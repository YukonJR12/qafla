"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { LanguageSwitch } from "@/components/language-switch";
import { ParkSlotDetail } from "@/components/park-slot-detail";
import { ArrowForward, CheckIcon, Isolate, LockIcon, primaryButton, StateLabel } from "@/components/ui";
import { fetchMyRole, fetchParkTonight, type ParkTonight, type ParkTruck } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import {
  bookingDeadline,
  bookingState,
  busiestCell,
  busyLevel,
  currentSlot,
  deadlinePassed,
  parseSlot,
  SLOT_STARTS,
  type BookingState,
} from "@/lib/park";
import { supabaseBrowser } from "@/lib/supabase";
import { formatKuwaitTime, formatSlot, kuwaitNow } from "@/lib/time";
import { useLiveOrders } from "@/lib/use-live-orders";
import { useSession } from "@/lib/use-session";

// Dana's dashboard: tonight across the park.
//
// Desktop shows six trucks across the 24 pickup times. A phone shows a time
// selector and six truck rows. Either way, one tap on a count opens the
// tickets that explain it.
//
// Nothing here decides who the manager is. The database does: row-level
// security returns every truck's orders only to the manager's account, and
// close_truck_for_tonight refuses everyone else.
export default function ManagerPage() {
  return (
    <Suspense>
      <ManagerDashboard />
    </Suspense>
  );
}

/** How a cell is tinted: white toward pale orange, and solid Red Orange when full. */
const TINT = [
  "bg-snowy-white text-muted",
  "bg-red-orange/8 text-ink",
  "bg-red-orange/20 text-ink",
  "bg-red-orange/35 text-ink font-extrabold",
  "bg-red-orange text-ink font-extrabold",
] as const;

function ManagerDashboard() {
  const { locale, t } = useLocale();
  const { loading: sessionLoading, session } = useSession();
  const userId = session?.user.id ?? null;

  // Step 1: is this the manager's account? (Only to choose what to show.)
  const [who, setWho] = useState<{ userId: string; role: string | null; failed: boolean } | null>(null);
  const [roleTry, setRoleTry] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchMyRole(supabaseBrowser(), userId).then(
      (role) => current && setWho({ userId, role, failed: false }),
      () => current && setWho({ userId, role: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [userId, roleTry]);
  const account = who?.userId === userId ? who : null;
  const isManager = account?.role === "manager";

  // Step 2: tonight's trucks, counts and orders.
  const [park, setPark] = useState<ParkTonight | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const readNumber = useRef(0); // so an older, slower read never overwrites a newer one

  const reread = useCallback(async () => {
    if (!isManager) return;
    const mine = ++readNumber.current;
    try {
      const fresh = await fetchParkTonight(supabaseBrowser());
      if (mine !== readNumber.current) return;
      setPark(fresh);
      setLoadFailed(false);
    } catch (error) {
      if (mine === readNumber.current) setLoadFailed(true);
      throw error;
    }
  }, [isManager]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  // The Kuwait clock, for "can this time still be booked?". Checked twice a minute.
  const [now, setNow] = useState(() => kuwaitNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(kuwaitNow()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Every new order and status change in the park nudges a re-read.
  const live = useLiveOrders({
    enabled: isManager,
    channel: "park-tonight",
    filter: `service_date=eq.${now.date}`,
    reread,
  });

  // The selected time and truck live in the address, so changing language,
  // closing a dialog or reloading keeps Dana on the same slot.
  const params = useSearchParams();
  const slot = parseSlot(params.get("slot")) ?? currentSlot(now.seconds);
  const truckId = params.get("truck");
  const selected = park?.trucks.find((truck) => truck.id === truckId) ?? null;

  function select(next: { slot: string; truck: string | null }) {
    const query = new URLSearchParams({ slot: next.slot.slice(0, 5) });
    if (next.truck) query.set("truck", next.truck);
    const url = `?${query}`;
    // Opening a slot adds a history step, so the phone's Back button returns to the overview.
    if (next.truck && !truckId) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  // If the tickets and the count disagree, an order changed between the two reads. Read again.
  const selectedBooked = selected?.slots.find((s) => s.slot_start === slot)?.booked;
  const selectedCounted = selected
    ? park!.orders.filter(
        (order) =>
          order.truck_id === selected.id && order.slot_start === slot && order.status !== "rejected" && order.status !== "cancelled",
      ).length
    : undefined;
  useEffect(() => {
    if (selectedBooked === undefined || selectedBooked === selectedCounted) return;
    const timer = setTimeout(() => reread().catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [selectedBooked, selectedCounted, reread]);

  // The database confirmed a closure: show it at once, then re-read everything.
  const [notice, setNotice] = useState<string | null>(null);
  function closed(closure: { truck_id: string; closed_at: string }) {
    readNumber.current++; // drop any read that started before this answer
    setPark(
      (was) =>
        was && {
          ...was,
          trucks: was.trucks.map((truck) =>
            truck.id === closure.truck_id ? { ...truck, closed: true, closedAt: closure.closed_at } : truck,
          ),
        },
    );
    const truck = park?.trucks.find((item) => item.id === closure.truck_id);
    if (truck) setNotice(t.closedConfirmed(truckName(truck, locale), formatKuwaitTime(closure.closed_at, locale)));
    reread().catch(() => {});
  }

  const cells = (park?.trucks ?? []).flatMap((truck) =>
    truck.slots.map((s) => ({ truckId: truck.id, slot: s.slot_start, booked: s.booked, capacity: s.capacity })),
  );
  const busiest = busiestCell(cells);
  const busiestTruck = busiest && park?.trucks.find((truck) => truck.id === busiest.truckId);
  const nextSlot = currentSlot(now.seconds);

  /** The short booking line for one truck at one time. */
  function bookingLine(truck: ParkTruck, at: string): { state: BookingState; text: string } {
    const usage = truck.slots.find((s) => s.slot_start === at);
    const booked = usage?.booked ?? 0;
    const capacity = usage?.capacity ?? truck.slot_capacity;
    const state = bookingState({ slot: at, booked, capacity, truckClosed: truck.closed, nowSeconds: now.seconds });
    const text =
      state === "truck_closed"
        ? t.bookingTruckClosed
        : state === "deadline_passed"
          ? t.bookingDeadline(formatSlot(bookingDeadline(at), locale))
          : state === "full"
            ? t.bookingFull
            : t.placesLeft(capacity - booked);
    return { state, text };
  }

  const signedOut = !sessionLoading && !session;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-divider bg-snowy-white">
        <div className="mx-auto max-w-[1440px] px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted">
                {t.appName} · {t.managerTitle}
              </p>
              <h1 className="text-xl leading-tight font-extrabold text-balance">{t.tonightGrid}</h1>
            </div>
            <LanguageSwitch />
          </div>
          {isManager && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-bold">
                <Isolate>{t.kuwaitTimeNow(formatKuwaitTime(new Date(), locale))}</Isolate>
              </span>
              <span role="status" className="inline-flex items-center gap-1.5 font-semibold text-muted">
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${live === "live" ? "border border-ink bg-yellow-punk" : "bg-outline"}`}
                />
                {live === "live" ? t.live : live === "reconnecting" ? t.reconnecting : t.loading}
              </span>
              <button
                type="button"
                onClick={() => supabaseBrowser().auth.signOut()}
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
            <h2 className="text-2xl font-extrabold">{t.managerSignInTitle}</h2>
            <p className="mt-2 text-muted">{t.managerSignInBody}</p>
            <Link href="/sign-in?next=/manager" className={`${primaryButton} mt-6`}>
              {t.signIn}
            </Link>
          </div>
        ) : account?.failed ? (
          <LoadError title={t.parkLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => setRoleTry((n) => n + 1)} />
        ) : !isManager ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.notManagerTitle}</h2>
            <p className="mt-2 text-muted">{t.notManagerBody}</p>
            <button type="button" onClick={() => supabaseBrowser().auth.signOut()} className={`${primaryButton} mt-6`}>
              {t.signOut}
            </button>
          </div>
        ) : !park ? (
          loadFailed ? (
            <LoadError title={t.parkLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => reread().catch(() => {})} />
          ) : (
            <div role="status" aria-label={t.loading} className="space-y-3">
              <div className="h-16 rounded-panel bg-subtle" />
              <div className="h-80 rounded-panel bg-subtle" />
            </div>
          )
        ) : (
          <>
            {notice && (
              <p role="status" className="mb-4 flex items-start gap-2 rounded-control bg-ink p-3 font-semibold text-snowy-white">
                <CheckIcon className="mt-0.5 size-5 shrink-0" />
                {notice}
              </p>
            )}

            {/* On a phone the slot's orders replace the overview; from 768 px both show. */}
            <div className={selected ? "hidden md:block" : ""}>
              {/* What should catch the eye first: which truck and time are busiest. */}
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 rounded-panel bg-ink px-4 py-3 text-snowy-white">
                <p className="min-w-0">
                  <span className="block text-sm font-semibold">{t.busiest}</span>
                  {busiest && busiestTruck ? (
                    <button
                      type="button"
                      onClick={() => select({ slot: busiest.slot, truck: busiest.truckId })}
                      className="min-h-11 text-start text-2xl leading-tight font-extrabold underline decoration-yellow-punk decoration-2 underline-offset-4"
                    >
                      {truckName(busiestTruck, locale)} · <Isolate>{formatSlot(busiest.slot, locale)}</Isolate>
                    </button>
                  ) : (
                    <span className="text-2xl leading-tight font-extrabold">{t.noOrdersTonight}</span>
                  )}
                </p>
                {busiest && (
                  <p className="text-xl font-extrabold text-yellow-punk tabular-nums">
                    {t.countOf(busiest.booked, busiest.capacity)}
                    {busiest.booked >= busiest.capacity && ` · ${t.full}`}
                  </p>
                )}
              </div>

              {/* ---------- Phone: a time selector, then six truck rows ---------- */}
              <div className="md:hidden">
                <TimeSelector
                  slot={slot}
                  nextSlot={nextSlot}
                  fullAt={(at) => park.trucks.some((truck) => truck.slots.some((s) => s.slot_start === at && s.booked >= s.capacity))}
                  onSelect={(at) => select({ slot: at, truck: null })}
                />

                <section aria-labelledby="rows-title" className="mt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-divider pb-2">
                    <h2 id="rows-title" className="text-lg font-extrabold">
                      <Isolate>{t.trucksAt(formatSlot(slot, locale))}</Isolate>
                    </h2>
                    <p className="text-sm text-muted">{t.tapForOrders}</p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {park.trucks.map((truck) => {
                      const usage = truck.slots.find((s) => s.slot_start === slot);
                      const booked = usage?.booked ?? 0;
                      const capacity = usage?.capacity ?? truck.slot_capacity;
                      const line = bookingLine(truck, slot);
                      return (
                        <li key={truck.id}>
                          <button
                            type="button"
                            onClick={() => select({ slot, truck: truck.id })}
                            className="flex min-h-16 w-full items-center gap-3 rounded-panel border border-divider p-3 text-start transition-colors duration-[120ms] ease-out hover:border-ink"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-extrabold">
                                {truckName(truck, locale)}
                                {truck.closed && <StateLabel className="px-2! py-0.5! text-xs!">{t.closedTonight}</StateLabel>}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                                {line.state !== "open" && line.state !== "truck_closed" && <LockIcon className="size-4 shrink-0" />}
                                {line.state === "truck_closed" ? t.seeOrders : line.text}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-control border px-2.5 py-1.5 text-center leading-tight tabular-nums ${
                                booked >= capacity ? "border-ink" : "border-divider"
                              } ${TINT[busyLevel(booked, capacity)]}`}
                            >
                              <span className="block text-lg font-extrabold text-ink">{t.countOf(booked, capacity)}</span>
                              {booked >= capacity && <span className="block text-xs font-extrabold">{t.full}</span>}
                            </span>
                            <ArrowForward className="size-5 text-muted" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>

              {/* ---------- 768 px and up: six trucks across 24 times ---------- */}
              <div className="hidden md:block">
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <p className="text-sm text-muted">{t.tonightGridHint}</p>
                  <ul aria-label={t.legendTitle} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
                    {[t.legendEmpty, t.legendFilling, t.legendFilling, t.legendNearly, t.full].map((label, level) =>
                      level === 2 ? null : (
                        <li key={level} className="flex items-center gap-1.5">
                          <span aria-hidden className={`size-4 rounded-sm border border-outline ${TINT[level]}`} />
                          {label}
                        </li>
                      ),
                    )}
                    <li className="flex items-center gap-1.5">
                      <LockIcon className="size-4" />
                      {t.legendBookingClosed}
                    </li>
                  </ul>
                </div>

                <div
                  role="region"
                  aria-label={t.tonightGrid}
                  tabIndex={0}
                  className="mt-3 overflow-x-auto rounded-panel border border-divider"
                >
                  <table className="w-full min-w-[1104px] table-fixed border-collapse text-sm">
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          className="sticky start-0 z-10 w-36 border-b border-divider bg-snowy-white px-3 py-2 text-start font-bold lg:w-44"
                        >
                          {t.truckColumn}
                        </th>
                        {SLOT_STARTS.map((at) => {
                          const passed = deadlinePassed(at, now.seconds);
                          return (
                            <th
                              key={at}
                              scope="col"
                              className={`border-b border-divider px-0 py-1.5 text-center tabular-nums ${
                                at === nextSlot ? "bg-yellow-punk font-extrabold" : passed ? "font-semibold text-muted" : "font-bold"
                              }`}
                            >
                              <bdi aria-hidden>{formatSlot(at, locale).split(" ")[0]}</bdi>
                              <span className="sr-only">
                                {formatSlot(at, locale)}
                                {passed ? `. ${t.legendBookingClosed}` : ""}
                              </span>
                              <span aria-hidden className="flex h-4 items-center justify-center">
                                {passed && <LockIcon className="size-3.5" />}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {park.trucks.map((truck) => (
                        <tr key={truck.id}>
                          <th
                            scope="row"
                            className="sticky start-0 z-10 border-b border-divider bg-snowy-white px-3 py-1.5 text-start align-middle leading-tight"
                          >
                            <span className="block font-extrabold">{truckName(truck, locale)}</span>
                            {truck.closed ? (
                              <StateLabel className="mt-0.5 px-1.5! py-0! text-xs!">{t.closedTonight}</StateLabel>
                            ) : (
                              <span className="block text-xs font-semibold text-muted">{t.capacityPerSlot(truck.slot_capacity)}</span>
                            )}
                          </th>
                          {truck.slots.map((s) => {
                            const isSelected = truck.id === truckId && s.slot_start === slot;
                            const full = s.booked >= s.capacity;
                            return (
                              <td key={s.slot_start} className="border-b border-s border-divider p-0">
                                <button
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-label={t.cellLabel(
                                    truckName(truck, locale),
                                    formatSlot(s.slot_start, locale),
                                    t.countOf(s.booked, s.capacity),
                                    bookingLine(truck, s.slot_start).text,
                                  )}
                                  onClick={() => select({ slot: s.slot_start, truck: truck.id })}
                                  className={`flex h-12 w-full flex-col items-center justify-center leading-none tabular-nums transition-shadow duration-[120ms] ease-out hover:shadow-[inset_0_0_0_2px_var(--color-outline)] ${
                                    TINT[busyLevel(s.booked, s.capacity)]
                                  } ${isSelected ? "shadow-[inset_0_0_0_3px_var(--color-ink)]!" : ""}`}
                                >
                                  <bdi className={s.booked === 0 ? "font-medium" : full ? "" : "font-bold"}>
                                    {s.booked}/{s.capacity}
                                  </bdi>
                                  {full && <span className="mt-0.5 text-[11px]">{t.full}</span>}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!selected && <p className="mt-6 rounded-panel bg-subtle p-4 text-muted">{t.selectACell}</p>}
              </div>
            </div>

            {selected && (
              <ParkSlotDetail
                truck={selected}
                slot={slot}
                orders={park.orders}
                nowSeconds={now.seconds}
                onBack={() => select({ slot, truck: null })}
                onClosed={closed}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** The phone's time selector: all 24 pickup times in one row that scrolls sideways. */
function TimeSelector({
  slot,
  nextSlot,
  fullAt,
  onSelect,
}: {
  slot: string;
  nextSlot: string;
  fullAt: (slot: string) => boolean;
  onSelect: (slot: string) => void;
}) {
  const { locale, t } = useLocale();
  const chosen = useRef<HTMLButtonElement>(null);

  // Bring the chosen time into view without moving the page.
  useEffect(() => {
    chosen.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [slot]);

  return (
    <section aria-labelledby="times-title" className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="times-title" className="text-lg font-extrabold">
          {t.selectTime}
        </h2>
        <p className="text-sm text-muted">{t.slotsTonight}</p>
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pt-1 pb-2">
        {SLOT_STARTS.map((at) => {
          const isChosen = at === slot;
          const tag = fullAt(at) ? t.full : at === nextSlot ? t.dueNext : null;
          return (
            <button
              key={at}
              ref={isChosen ? chosen : undefined}
              type="button"
              aria-pressed={isChosen}
              onClick={() => onSelect(at)}
              className={`flex min-h-12 shrink-0 flex-col items-center justify-center rounded-control border px-3 py-1 leading-tight transition-colors duration-[120ms] ease-out ${
                isChosen ? "border-ink bg-ink text-snowy-white" : "border-outline bg-snowy-white hover:border-ink"
              }`}
            >
              <span className="flex items-center gap-1 font-bold">
                {isChosen && <CheckIcon className="size-4" />}
                <Isolate>{formatSlot(at, locale)}</Isolate>
              </span>
              {tag && <span className={`text-xs font-bold ${isChosen ? "text-yellow-punk" : "text-muted"}`}>{tag}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
