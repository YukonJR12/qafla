"use client";

import { useEffect, useId, useRef, useState } from "react";
import { closeTruckForTonight, type ParkOrder, type ParkTruck } from "@/lib/data";
import { itemName, truckName } from "@/lib/i18n";
import { isActive } from "@/lib/kitchen";
import { useLocale } from "@/lib/locale";
import { bookingDeadline, bookingState, explainSlot, type BookingState } from "@/lib/park";
import { supabaseBrowser } from "@/lib/supabase";
import { formatKuwaitTime, formatSlot } from "@/lib/time";
import { StatusChip } from "./kitchen-ticket";
import { ArrowBack, Isolate, LockIcon, Money, primaryButton, secondaryButton, StateLabel } from "./ui";

/**
 * One truck at one pickup time, explained: the database's count, whether a
 * customer can still book, and the tickets that add up to the count.
 *
 * "Places taken" and "Booking" are separate lines on purpose. A time can
 * have a free place and still be closed for booking (its deadline passed),
 * and Dana needs to tell that apart from a time that is full.
 */
export function ParkSlotDetail({
  truck,
  slot,
  orders,
  nowSeconds,
  onBack,
  onClosed,
}: {
  truck: ParkTruck;
  /** "19:15:00" */
  slot: string;
  /** Every order in the park tonight; this picks out its own. */
  orders: ParkOrder[];
  /** Seconds into the Kuwait day. */
  nowSeconds: number;
  onBack: () => void;
  /** The database confirmed the closure. */
  onClosed: (closure: { truck_id: string; closed_at: string }) => void;
}) {
  const { locale, t } = useLocale();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  const name = truckName(truck, locale);
  const time = formatSlot(slot, locale);
  const usage = truck.slots.find((s) => s.slot_start === slot);
  const booked = usage?.booked ?? 0;
  const capacity = usage?.capacity ?? truck.slot_capacity;
  const left = Math.max(capacity - booked, 0);
  const { counted, freed } = explainSlot(orders, truck.id, slot);
  const adds = counted.length === booked;
  const booking = bookingState({ slot, booked, capacity, truckClosed: truck.closed, nowSeconds });
  const deadline = formatSlot(bookingDeadline(slot), locale);
  const activeTonight = orders.filter((order) => order.truck_id === truck.id && isActive(order.status)).length;

  // On a phone this view replaces the overview, so start reading from its heading.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.scrollTo(0, 0);
      heading.current?.focus();
    }
  }, [truck.id, slot]);

  const bookingText: Record<BookingState, string> = {
    open: t.bookingOpenLong(left, deadline),
    full: t.bookingFullLong,
    deadline_passed: t.bookingDeadlineLong(deadline, left),
    truck_closed: t.bookingTruckClosedLong(left),
  };

  return (
    <section aria-labelledby={`${id}-title`} className="md:mt-6 md:rounded-panel md:border md:border-ink md:p-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.backToOverview(time)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-subtle text-ink transition-colors duration-[120ms] ease-out hover:bg-divider md:hidden"
        >
          <ArrowBack className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{t.slotDetails}</p>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-2xl leading-tight font-extrabold text-balance outline-none">
            {name} · <Isolate>{time}</Isolate>
          </h2>
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          {/* 1. How many places are taken. The number is the database's own count. */}
          <div
            className={`rounded-panel border p-4 ${
              booked >= capacity ? "border-ink bg-red-orange" : "border-divider bg-subtle"
            }`}
          >
            <p className="text-sm font-semibold">{t.placesTaken}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-3xl leading-tight md:text-4xl font-extrabold tabular-nums">
              {t.countOfOrders(booked, capacity)}
              {booked >= capacity && <span className="text-xl">{t.full}</span>}
            </p>
          </div>

          {/* 2. Whether a customer can still book it. A separate question. */}
          <div className="mt-3 rounded-panel border border-divider p-4">
            <p className="text-sm font-semibold text-muted">{t.bookingLabel}</p>
            <p className="mt-0.5 flex items-start gap-2 font-semibold">
              {booking !== "open" && <LockIcon className="mt-0.5 size-5 shrink-0" />}
              <span>{bookingText[booking]}</span>
            </p>
          </div>

          {/* The truck itself: open, or closed for tonight. */}
          <div className="mt-3 rounded-panel border border-divider p-4">
            <p className="flex flex-wrap items-center gap-2 font-extrabold">
              {name}
              {truck.closed && <StateLabel>{t.closedTonight}</StateLabel>}
            </p>
            {truck.closedAt ? (
              <p className="mt-1 text-sm text-muted">{t.closedSince(formatKuwaitTime(truck.closedAt, locale))}</p>
            ) : (
              <>
                {!truck.is_open && <p className="mt-1 text-sm text-muted">{t.closedByVendor}</p>}
                <CloseTruck truck={truck} name={name} active={activeTonight} onClosed={onClosed} />
              </>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {/* The tickets that add up to the count. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-divider pb-2">
            <h3 className="text-lg font-extrabold">{counted.length === 0 ? t.countedNone : t.countedTitle(counted.length)}</h3>
            <p role="status" className={`text-sm font-semibold ${adds ? "text-muted" : "text-warning"}`}>
              {adds ? t.matchesCount(t.countOf(booked, capacity)) : t.countMismatch}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">{t.countRule}</p>

          {counted.length > 0 && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {counted.map((order) => (
                <li key={order.id} className="rounded-panel border border-divider p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Isolate className="font-extrabold">{order.ticket_ref}</Isolate>
                    <StatusChip status={order.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold wrap-anywhere">
                    {order.order_items
                      .map((line) => `${line.quantity} × ${itemName({ id: line.item_id, name: line.item_name }, locale)}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-divider pt-2 text-sm text-muted">
                    <span>
                      {order.status === "collected"
                        ? t.collectedAt(formatKuwaitTime(order.updated_at, locale))
                        : `${t.payAtPickup} · ${t.unpaid}`}
                    </span>
                    <Money amount={order.total_kwd} locale={locale} className="font-bold text-ink" />
                  </p>
                </li>
              ))}
            </ul>
          )}

          {/* Rejected and cancelled orders are listed apart: they do not count. */}
          {freed.length > 0 && (
            <div className="mt-5 rounded-panel bg-subtle p-3">
              <h3 className="font-extrabold">{t.freedTitle(freed.length)}</h3>
              <p className="text-sm text-muted">{t.freedBody}</p>
              <ul className="mt-2 divide-y divide-divider">
                {freed.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Isolate className="font-bold">{order.ticket_ref}</Isolate>
                    <StatusChip status={order.status} />
                    {order.rejection_reason && <span className="basis-full text-sm text-muted">{order.rejection_reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onBack} className={`${secondaryButton} mt-6 md:hidden`}>
        <ArrowBack className="size-5" />
        {t.backToOverview(time)}
      </button>
    </section>
  );
}

/**
 * "Close for tonight" and its confirmation.
 *
 * The truck is only shown as closed after the database answers
 * (close_truck_for_tonight). The database also decides who may do this: an
 * account that is not the park manager is refused there, whatever this
 * screen shows. "Keep open" closes the dialog and changes nothing, so the
 * selected truck and time stay as they were and focus returns to the button.
 */
function CloseTruck({
  truck,
  name,
  active,
  onClosed,
}: {
  truck: ParkTruck;
  name: string;
  active: number;
  onClosed: (closure: { truck_id: string; closed_at: string }) => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const keepOpen = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"failed" | "not_allowed" | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const closure = await closeTruckForTonight(supabaseBrowser(), truck.id);
      dialog.current?.close();
      onClosed(closure);
    } catch (error) {
      setProblem(error instanceof Error && error.message === "not_a_manager" ? "not_allowed" : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => {
          setProblem(null);
          dialog.current?.showModal();
          keepOpen.current?.focus(); // focus starts on the safe choice
        }}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-control border border-error px-4 py-3 font-bold text-error transition-colors duration-[120ms] ease-out hover:bg-error-surface"
      >
        {t.closeForTonight}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        // "Keep open" and Escape both land here: back to the button, nothing changed.
        onClose={() => opener.current?.focus()}
        onCancel={(event) => {
          if (busy) event.preventDefault(); // wait for the database's answer
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel bg-snowy-white p-5 text-ink backdrop:bg-ink/60"
      >
        <h2 id={`${id}-title`} className="text-2xl leading-tight font-extrabold text-balance">
          {t.closeTitle(name)}
        </h2>
        <div id={`${id}-body`} className="mt-3 space-y-2">
          <p>{t.closeBody}</p>
          <p className="text-sm text-muted">
            {t.closeActive(active)} {t.closeUntil}
          </p>
        </div>
        {problem && (
          <p role="alert" className="mt-3 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
            {problem === "not_allowed" ? t.closeNotAllowed : t.closeFailed(name)}
          </p>
        )}
        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy} aria-busy={busy} onClick={confirm} className={primaryButton}>
            <span aria-live="polite">
              {busy ? t.closing : problem === "failed" ? `${t.retry}: ${t.closeConfirm(name)}` : t.closeConfirm(name)}
            </span>
          </button>
          <button ref={keepOpen} type="button" disabled={busy} className={secondaryButton} onClick={() => dialog.current?.close()}>
            {t.keepOpen}
          </button>
        </div>
      </dialog>
    </>
  );
}
