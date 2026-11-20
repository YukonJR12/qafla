"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { LanguageSwitch } from "@/components/language-switch";
import { ArrowBack, CheckIcon, Isolate, MinusIcon, PlusIcon, primaryButton } from "@/components/ui";
import { capacityImpact, MAX_CAPACITY, MIN_CAPACITY, slotFit } from "@/lib/capacity";
import { fetchMyTruck, fetchSlots, setTruckCapacity, type Slot, type Truck } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { currentSlot } from "@/lib/park";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot, kuwaitNow } from "@/lib/time";
import { useLiveOrders } from "@/lib/use-live-orders";
import { useSession } from "@/lib/use-session";

// The vendor's capacity setting: how many orders the truck takes for each
// 15-minute pickup time, from 1 to 20.
//
// It is ONE number for the whole truck (trucks.slot_capacity), so changing
// it changes every pickup time. The screen says so in the control's label.
//
// The database decides who may change it (only the truck's assigned vendor)
// and keeps it inside 1 to 20. Changing it never touches an order: if the
// new number is below what a pickup time already holds, those orders stay
// and that time simply takes no new ones.
export default function CapacitySettingsPage() {
  const { locale, t } = useLocale();
  const { loading: sessionLoading, session } = useSession();
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
  const account = mine?.userId === userId ? mine : null;
  const truck = account?.truck ?? null;
  const truckId = truck?.id ?? null;

  // Step 2: tonight's 24 pickup times with the database's own counts.
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const readNumber = useRef(0);
  const reread = useCallback(async () => {
    if (!truckId) return;
    const mineNumber = ++readNumber.current;
    try {
      const fresh = await fetchSlots(supabaseBrowser(), truckId);
      if (mineNumber !== readNumber.current) return;
      setSlots(fresh);
      setLoadFailed(false);
    } catch (error) {
      if (mineNumber === readNumber.current) setLoadFailed(true);
      throw error;
    }
  }, [truckId]);
  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);
  // New orders and status changes keep the counts beside the control current.
  useLiveOrders({ enabled: truckId !== null, channel: `capacity-${truckId}`, filter: `truck_id=eq.${truckId}`, reread });

  // The saved setting is what the database last answered. `draft` is the
  // number on the stepper while the vendor is still choosing.
  const [savedOverride, setSavedOverride] = useState<number | null>(null);
  const saved = savedOverride ?? slots?.[0]?.capacity ?? truck?.slot_capacity ?? MIN_CAPACITY;
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? saved;
  const changed = value !== saved;

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "saved"; capacity: number } | { kind: "failed" } | { kind: "not_yours" } | null>(null);

  function step(by: number) {
    setDraft(Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, value + by)));
    setResult(null);
  }

  async function save() {
    if (!truck || busy || !changed) return;
    setBusy(true);
    setResult(null);
    try {
      const confirmed = await setTruckCapacity(supabaseBrowser(), truck.id, value);
      // Show exactly what the database saved, then re-read tonight's counts.
      setSavedOverride(confirmed);
      setDraft(null);
      setResult({ kind: "saved", capacity: confirmed });
      await reread().then(
        () => setSavedOverride(null),
        () => {},
      );
    } catch (error) {
      setResult({ kind: error instanceof Error && error.message === "not_your_truck" ? "not_yours" : "failed" });
    } finally {
      setBusy(false);
    }
  }

  const name = truck ? truckName(truck, locale) : t.capacitySettings;
  const signedOut = !sessionLoading && !session;
  const withOrders = (slots ?? []).filter((slot) => slot.booked > 0);
  const impact = capacityImpact(slots ?? [], saved, value);
  const times = (list: string[]) => list.map((slot) => formatSlot(slot, locale)).join(locale === "ar" ? "، " : ", ");
  const dueNext = currentSlot(kuwaitNow().seconds);
  const round =
    "inline-flex size-12 items-center justify-center rounded-control transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-divider bg-snowy-white">
        <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-2 md:px-6">
          <Link
            href="/vendor"
            aria-label={t.backToBoard}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-subtle text-ink transition-colors duration-[120ms] ease-out hover:bg-divider"
          >
            <ArrowBack className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">
              {t.appName} · {truck ? name : t.kitchenBoard}
            </p>
            <h1 className="text-xl leading-tight font-extrabold text-balance">{t.capacitySettings}</h1>
          </div>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-4 pt-5 pb-10 md:px-6">
        {sessionLoading || (userId && !account) ? (
          <p className="min-h-96 text-muted" aria-live="polite">
            {t.loading}
          </p>
        ) : signedOut ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.vendorSignInTitle}</h2>
            <p className="mt-2 text-muted">{t.vendorSignInBody}</p>
            <Link href="/sign-in?next=/vendor/capacity" className={`${primaryButton} mt-6`}>
              {t.signIn}
            </Link>
          </div>
        ) : account?.failed ? (
          <LoadError title={t.boardLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => setTruckTry((n) => n + 1)} />
        ) : !truck ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.notVendorTitle}</h2>
            <p className="mt-2 text-muted">{t.notVendorBody}</p>
            <button type="button" onClick={() => supabaseBrowser().auth.signOut()} className={`${primaryButton} mt-6`}>
              {t.signOut}
            </button>
          </div>
        ) : !slots ? (
          loadFailed ? (
            <LoadError title={t.boardLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => reread().catch(() => {})} />
          ) : (
            <div role="status" aria-label={t.loading} className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <div className="h-80 rounded-panel bg-subtle" />
              <div className="h-80 rounded-panel bg-subtle" />
            </div>
          )
        ) : (
          <div className="grid items-start gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            {/* ---------- The control ---------- */}
            <section aria-labelledby="capacity-title" className="rounded-panel border border-ink p-4 md:p-5">
              <h2 id="capacity-title" className="text-2xl leading-tight font-extrabold text-balance">
                {t.capacityTitle}
              </h2>
              {/* The scope, in words: this is the whole truck, not one pickup time. */}
              <p className="mt-2 inline-flex rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white">
                {t.capacityScope(name)}
              </p>
              <p id="capacity-help" className="mt-3 text-muted">
                {t.capacityBody(name)}
              </p>

              <div
                role="group"
                aria-labelledby="capacity-title"
                aria-describedby="capacity-help"
                className="mt-5 flex items-center justify-between gap-3 rounded-panel bg-subtle p-3"
              >
                <button
                  type="button"
                  aria-label={t.capacityFewer}
                  disabled={busy || value <= MIN_CAPACITY}
                  onClick={() => step(-1)}
                  className={`${round} border border-outline bg-snowy-white text-ink hover:border-ink`}
                >
                  <MinusIcon className="size-5" />
                </button>
                <p className="text-center leading-none" aria-live="polite" aria-atomic>
                  <span className="block text-5xl font-extrabold tabular-nums">{value}</span>
                  <span className="sr-only">{t.capacityValue(value)}</span>
                </p>
                <button
                  type="button"
                  aria-label={t.capacityMore}
                  disabled={busy || value >= MAX_CAPACITY}
                  onClick={() => step(1)}
                  className={`${round} bg-ink text-snowy-white hover:bg-ink-pressed`}
                >
                  <PlusIcon className="size-5" />
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold text-muted">{t.capacitySavedSetting(saved)}</p>

              {/* What this change would do tonight, before it is saved. */}
              {changed && impact.over.length > 0 && (
                <p className="mt-3 rounded-control bg-warning-surface p-3 text-sm font-semibold text-warning">
                  {t.impactOver(value, times(impact.over))}
                </p>
              )}
              {changed && impact.becomesFull.length > 0 && (
                <p className="mt-3 rounded-control bg-warning-surface p-3 text-sm font-semibold text-warning">
                  {t.impactFull(value, times(impact.becomesFull))}
                </p>
              )}
              {changed && impact.reopens.length > 0 && (
                <p className="mt-3 rounded-control bg-subtle p-3 text-sm font-semibold">{t.impactReopens(value, times(impact.reopens))}</p>
              )}

              {result && result.kind !== "saved" && (
                <p role="alert" className="mt-3 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
                  {result.kind === "not_yours" ? t.capacityNotYours : t.capacityFailed(saved)}
                </p>
              )}
              <button
                type="button"
                disabled={busy || !changed}
                aria-busy={busy}
                aria-describedby={changed ? undefined : "capacity-unchanged"}
                onClick={save}
                className={`${primaryButton} mt-4`}
              >
                <span aria-live="polite">
                  {busy ? t.saving : result?.kind === "failed" ? `${t.retry}: ${t.capacitySave(name)}` : t.capacitySave(name)}
                </span>
              </button>
              {!changed && result?.kind !== "saved" && (
                <p id="capacity-unchanged" className="mt-2 text-sm text-muted">
                  {t.capacityUnchanged}
                </p>
              )}
              <p role="status" className="mt-3">
                {result?.kind === "saved" && (
                  <span className="flex items-start gap-2 rounded-control border border-ink bg-yellow-punk p-3 font-semibold">
                    <CheckIcon className="mt-0.5 size-5 shrink-0" />
                    {t.capacitySaved(name, result.capacity)}
                  </span>
                )}
              </p>
            </section>

            {/* ---------- Tonight's occupancy, measured against the number on the control ---------- */}
            <div className="min-w-0">
              <section aria-labelledby="tonight-title">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-divider pb-2">
                  <h2 id="tonight-title" className="text-lg font-extrabold">
                    {changed ? t.tonightAt(value) : t.tonightTimes}
                  </h2>
                  {changed && <span className="rounded-control bg-warning-surface px-2 py-0.5 text-sm font-bold text-warning">{t.notSavedYet}</span>}
                </div>

                {withOrders.length === 0 ? (
                  <p className="mt-3 text-muted">{t.noOrdersForTonight}</p>
                ) : (
                  <>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {withOrders.map((slot) => {
                        const fit = slotFit(slot.booked, value);
                        return (
                          <li
                            key={slot.slot_start}
                            className={`flex items-center gap-3 rounded-panel border p-3 ${
                              fit === "open" ? "border-divider" : "border-ink"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-x-2 font-extrabold">
                                <Isolate>{formatSlot(slot.slot_start, locale)}</Isolate>
                                {slot.slot_start === dueNext && (
                                  <span className="rounded-full border border-ink bg-yellow-punk px-2 text-xs font-bold">{t.dueNext}</span>
                                )}
                              </p>
                              <p className={`text-sm ${fit === "over" ? "font-semibold text-warning" : "text-muted"}`}>
                                {fit === "open"
                                  ? t.placesLeft(value - slot.booked)
                                  : fit === "full"
                                    ? t.bookingFull
                                    : t.overLimit(slot.booked - value)}
                              </p>
                            </div>
                            <p
                              className={`shrink-0 rounded-control px-2.5 py-1.5 text-center leading-tight tabular-nums ${
                                fit === "open" ? "bg-subtle" : "bg-red-orange"
                              }`}
                            >
                              <span className="block text-lg font-extrabold">{t.countOf(slot.booked, value)}</span>
                              {fit !== "open" && <span className="block text-xs font-extrabold">{t.full}</span>}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    {withOrders.length < slots.length && (
                      <p className="mt-3 text-sm text-muted">{t.otherTimesEmpty(slots.length - withOrders.length)}</p>
                    )}
                  </>
                )}
              </section>

              <section aria-labelledby="rules-title" className="mt-6 rounded-panel bg-subtle p-4">
                <h2 id="rules-title" className="font-extrabold">
                  {t.countingRules}
                </h2>
                <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted">
                  <li>{t.ruleCollected}</li>
                  <li>{t.ruleFreed}</li>
                  <li>{t.ruleKept}</li>
                </ul>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
