"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CartSkeleton, EmptyCart, LoadError } from "@/components/cart-states";
import {
  ArrowForward,
  CheckIcon,
  ClockOffIcon,
  Isolate,
  Money,
  StoreIcon,
  primaryButton,
  primaryButtonSplit,
  secondaryButton,
} from "@/components/ui";
import { requestIdForCart, storedCart, useCart } from "@/lib/cart";
import { orderItems } from "@/lib/cart-lines";
import { fetchClosed, fetchSlots, isFull, nextBookable, upcomingSlots, type Slot } from "@/lib/data";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import {
  abandonAttempt,
  clearPending,
  findOrderForAttempt,
  outcomeOf,
  readPending,
  savePending,
  type PendingOrder,
} from "@/lib/pending-order";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot, slotSeconds } from "@/lib/time";
import { useCartLines } from "@/lib/use-cart-lines";
import { useSession } from "@/lib/use-session";

type Problem = "itemUnavailable" | "notCustomer" | "genericError";

/** Pickup times as last read from the database, or a failed read. */
type Availability =
  | { truckId: string; attempt: number; failed: true }
  | { truckId: string; attempt: number; failed: false; slots: Slot[]; closed: boolean };

/**
 * Where this customer's unconfirmed attempt stands, if they have one.
 *  - none:      there is no unconfirmed attempt
 *  - unknown:   not settled yet. `last` says what the latest question got:
 *               "empty" (no order yet; it may still arrive) or "failed"
 *               (no answer at all). Neither proves the attempt is over.
 *  - abandoned: the customer gave up and the server recorded it, so the
 *               old request can never place an order
 * (When the order WAS saved, the page goes straight to its ticket instead.)
 */
type Reconciled =
  | { userId: string; check: number; result: "none" | "abandoned" }
  | { userId: string; check: number; result: "unknown"; pending: PendingOrder; last: "none" | "empty" | "failed" };

// Checkout: review the cart, choose a pickup time, pay at pickup, place the order.
export default function CheckoutPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { cart, count, setSlot, forgetRequest, clear } = useCart();
  const cartLines = useCartLines();
  const { loading: sessionLoading, session } = useSession();

  const truckId = cart?.truckId;
  const [attempt, setAttempt] = useState(0);
  const [availability, setAvailability] = useState<Availability | null>(null);
  /** The unavailable time the customer just replaced, kept to confirm the change. */
  const [replaced, setReplaced] = useState<{ slot: string; full: boolean } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const placeButton = useRef<HTMLButtonElement>(null);

  const userId = session?.user.id ?? null;
  /** Goes up by one each time the customer taps "Check my order". */
  const [check, setCheck] = useState(0);
  const [reconciled, setReconciled] = useState<Reconciled | null>(null);
  const [leaving, setLeaving] = useState(false);

  // The order turned out to exist. Open its ticket; never place it again.
  const openTicket = useCallback(
    (customerId: string, pending: PendingOrder, orderId: string) => {
      clearPending(customerId);
      if (storedCart()?.requestId === pending.requestId) clear();
      setPlaced(true);
      router.replace(`/orders/${orderId}`);
    },
    [clear, router],
  );

  // Before anything else: did this customer send an order whose answer never
  // arrived? If so, ask the server about it. Until it is settled, the page
  // must not say "that time is full" or "the truck closed", because the
  // place that filled the slot may be this customer's own order.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    lookUpPending(userId).then((found) => {
      if (!live) return;
      if (found.result === "saved") openTicket(userId, found.pending, found.orderId);
      else setReconciled({ userId, check, ...found });
    });
    return () => {
      live = false;
    };
  }, [userId, check, openTicket]);

  // "Go back to checkout": the customer gives up on the unconfirmed attempt.
  // The database settles it against the original request. Only its answer
  // unlocks the cart: either the ticket, or a recorded "abandoned".
  async function leaveAttempt(pending: PendingOrder) {
    if (!userId || leaving) return;
    setLeaving(true);
    const settled = await abandonAttempt(supabaseBrowser(), pending).then(
      (orderId) => ({ orderId }),
      () => null,
    );
    setLeaving(false);
    if (!settled) {
      // No clear answer to this either. Still unknown; nothing is unlocked.
      setReconciled({ userId, check, result: "unknown", pending, last: "failed" });
    } else if (settled.orderId) {
      openTicket(userId, pending, settled.orderId);
    } else {
      clearPending(userId);
      forgetRequest(); // the old ID is dead; the next order gets a new one
      setReconciled({ userId, check, result: "abandoned" });
      setAttempt((n) => n + 1); // re-read the pickup times
    }
  }

  // Read the truck's live slot counts and whether it is closed tonight.
  useEffect(() => {
    if (!truckId) return;
    let live = true;
    loadAvailability(truckId)
      .then((fresh) => {
        if (!live) return;
        setAvailability({ truckId, attempt, failed: false, ...fresh });
        // Default to the earliest time ONLY when no time has been chosen yet.
        // A time the customer chose is never swapped for another one here,
        // even if it is no longer available: that case is explained on
        // screen and the customer picks again.
        if (attempt === 0 && storedCart()?.slot == null) {
          setSlot(nextBookable(fresh.slots)?.slot_start ?? null);
        }
      })
      .catch(() => {
        if (live) setAvailability({ truckId, attempt, failed: true });
      });
    return () => {
      live = false;
    };
  }, [truckId, attempt, setSlot]);

  const current = availability && availability.truckId === truckId && availability.attempt === attempt ? availability : null;
  const reload = () => setAttempt((n) => n + 1);

  if (placed) {
    return (
      <Shell>
        <p className="min-h-64 text-muted" aria-live="polite">
          {t.placing}
        </p>
      </Shell>
    );
  }

  const mine = userId && reconciled?.userId === userId ? reconciled : null;
  if (sessionLoading || (userId && !mine)) {
    return (
      <Shell>
        <CartSkeleton />
      </Shell>
    );
  }
  if (mine?.result === "unknown") {
    // The outcome is not known yet. Nothing below may be shown: no "slot
    // full", no "truck closed", no other time, and no Place order button.
    const busy = mine.check !== check;
    const { pending } = mine;
    return (
      <Shell>
        <section role="alert" className="rounded-panel bg-warning-surface p-4 text-warning">
          <h2 className="text-base leading-snug font-extrabold">{t.checkOrderTitle}</h2>
          <p className="mt-1 text-sm">
            {t.checkOrderBody(
              truckName({ id: pending.truckId, name: pending.truckName }, locale),
              formatSlot(pending.slot, locale),
            )}
          </p>
          {!busy && !leaving && mine.last !== "none" && (
            <p className="mt-2 text-sm font-bold">{mine.last === "empty" ? t.checkEmpty : t.checkFailed}</p>
          )}
          {/* Read-only: asks whether the order exists. It never places or cancels anything. */}
          <button
            type="button"
            onClick={() => setCheck((n) => n + 1)}
            disabled={busy || leaving}
            aria-busy={busy}
            className={`${primaryButton} mt-3`}
          >
            <span aria-live="polite">{busy ? t.checkingOrder : t.checkMyOrder}</span>
          </button>
          {/* The way out if the request never arrived. The server settles it. */}
          <button
            type="button"
            onClick={() => leaveAttempt(pending)}
            disabled={busy || leaving}
            aria-busy={leaving}
            aria-describedby="back-to-checkout-hint"
            className={`${secondaryButton} mt-2`}
          >
            <span aria-live="polite">{leaving ? t.goingBack : t.backToCheckout}</span>
          </button>
          <p id="back-to-checkout-hint" className="mt-2 text-sm">
            {t.backToCheckoutHint}
          </p>
        </section>
      </Shell>
    );
  }
  if (cartLines.status === "empty" || !cart) {
    return <Shell>{cartLines.status === "loading" ? <CartSkeleton /> : <EmptyCart />}</Shell>;
  }
  if (cartLines.status === "loading" || !current) {
    return (
      <Shell>
        <CartSkeleton />
      </Shell>
    );
  }
  if (cartLines.status === "error") {
    return (
      <Shell>
        <LoadError title={t.cartLoadErrorTitle} body={t.cartLoadErrorBody} onRetry={cartLines.retry} />
      </Shell>
    );
  }
  if (current.failed) {
    return (
      <Shell>
        <LoadError title={t.timesLoadErrorTitle} body={t.timesLoadErrorBody} onRetry={reload} />
      </Shell>
    );
  }

  const { lines, total, orderable } = cartLines;
  const { slots, closed } = current;
  const truck = { id: cart.truckId, name: cart.truckName };
  const name = truckName(truck, locale);
  const upcoming = upcomingSlots(slots);
  const saved = cart.slot;
  const savedSlot = saved ? upcoming.find((s) => s.slot_start === saved) : undefined;

  // The time that will be ordered: the saved one, if it can still be booked.
  const selected = savedSlot && !isFull(savedSlot) ? savedSlot.slot_start : null;
  // The saved time became unavailable: it filled, or it is now too close.
  const lost = saved && !selected ? { slot: saved, full: Boolean(savedSlot) } : null;
  // What the notice is about: the lost time, or the one just replaced.
  const notice = lost ?? replaced;
  const noticeSlot = notice?.slot ?? null;

  const earliest = nextBookable(slots)?.slot_start ?? null;
  // The next time that can still be booked after the lost one.
  const suggestion = lost
    ? (upcoming.find((s) => !isFull(s) && slotSeconds(s.slot_start) > slotSeconds(lost.slot))?.slot_start ??
      upcoming.find((s) => !isFull(s))?.slot_start ??
      null)
    : null;

  function choose(slot: string) {
    if (lost) setReplaced(lost);
    setSlot(slot);
  }

  async function placeOrder() {
    if (!cart || !selected || !orderable || placing || !userId) return;
    setPlacing(true);
    setProblem(null);
    setReconciled({ userId, check, result: "none" });

    // One ID per attempt. Tapping again after a lost answer sends the same
    // ID, so the database returns the order it already saved.
    const requestId = requestIdForCart(userId);
    if (!requestId) return;

    // Write the attempt down BEFORE sending it. If the answer is lost, or
    // the page is closed or refreshed, checkout can still ask about it.
    const pending: PendingOrder = {
      customerId: userId,
      requestId,
      truckId: truck.id,
      truckName: truck.name,
      slot: selected,
      items: cart.items,
    };
    savePending(pending);

    // Only IDs and quantities are sent, for EVERY saved dish. The database
    // looks up the prices, checks the truck, the time and the slot, and
    // saves the order in one step.
    const answer = await supabaseBrowser()
      .rpc("place_order", {
        p_truck_id: truck.id,
        p_slot_start: selected,
        p_items: orderItems(cart.items),
        p_request_id: requestId,
      })
      .then(
        (result) => result,
        () => ({ data: null, error: { message: "network" } }),
      );
    const { data, error } = answer;
    const outcome = outcomeOf(answer);

    if (outcome === "saved" && data) {
      clearPending(userId);
      setPlaced(true);
      clear();
      // replace(), not push(): Back must not return to a form that could order again.
      router.replace(`/orders/${data.id}`);
      return;
    }

    setPlacing(false);
    if (outcome === "unknown") {
      // No clear answer (for example the connection dropped). The order may
      // have been saved, so the attempt and its request ID are kept, and the
      // customer checks on it instead of ordering again.
      setReconciled({ userId, check, result: "unknown", pending, last: "none" });
      return;
    }

    // The server refused THIS request: nothing was saved, nothing left to check.
    clearPending(userId);
    const code = error?.message ?? "";
    if (code === "slot_full" || code === "slot_too_soon" || code === "invalid_slot") {
      // The cart and the chosen time stay as they are. Re-reading the slots
      // shows that time as unavailable, and the customer picks a new one.
      reload();
    } else if (code === "truck_closed") {
      reload();
    } else if (code === "item_sold_out" || code === "item_not_on_menu") {
      setProblem("itemUnavailable");
      cartLines.retry();
    } else if (code === "not_a_customer") {
      setProblem("notCustomer");
    } else {
      // The ID was refused or is already tied to a different order: start a new attempt.
      forgetRequest();
      setProblem("genericError");
    }
  }

  return (
    <Shell>
      {/* The server recorded the attempt as abandoned. Normal recovery follows. */}
      {mine?.result === "abandoned" && (
        <p role="status" className="mb-4 rounded-panel bg-subtle p-4 text-sm font-semibold">
          {t.notPlaced}
        </p>
      )}

      {/* Recovery: the truck closed. Nothing was placed and the cart is kept. */}
      {closed && (
        <section role="alert" className="mb-4 rounded-panel bg-error-surface p-4 text-error">
          <div className="flex items-start gap-2.5">
            <StoreIcon className="mt-0.5 size-5" />
            <div>
              <h2 className="text-base leading-snug font-extrabold">{t.truckClosedTitle(name)}</h2>
              <p className="mt-1 text-sm">{t.truckClosedBody}</p>
            </div>
          </div>
          <Link href="/explore" className={`${primaryButton} mt-3`}>
            {t.browseOpen}
          </Link>
        </section>
      )}

      {/* Recovery: the chosen time is no longer available. Explain, and wait for a new choice. */}
      {!closed && noticeSlot && (
        <section role="alert" className="mb-4 rounded-panel bg-warning-surface p-4 text-warning">
          <div className="flex items-start gap-2.5">
            <ClockOffIcon className="mt-0.5 size-5" />
            <div>
              <h2 className="text-base leading-snug font-extrabold">
                {notice && !notice.full
                  ? t.slotPassedTitle(formatSlot(noticeSlot, locale))
                  : t.slotFilledTitle(formatSlot(noticeSlot, locale))}
              </h2>
              <p className="mt-1 text-sm">{notice && !notice.full ? t.slotGoneBody : t.slotFilledBody(name)}</p>
            </div>
          </div>
          {selected ? (
            <p className="mt-3 flex items-start gap-2 text-sm font-bold text-ink">
              <CheckIcon className="size-5" />
              {t.reviewTime(formatSlot(selected, locale))}
            </p>
          ) : suggestion ? (
            <button
              type="button"
              className={`${primaryButton} mt-3`}
              onClick={() => {
                choose(suggestion);
                // This button disappears once a time is chosen, so hand keyboard
                // focus to the Place order button instead of losing it.
                setTimeout(() => placeButton.current?.focus(), 0);
              }}
            >
              <Isolate>{t.useTime(formatSlot(suggestion, locale))}</Isolate>
            </button>
          ) : (
            <p className="mt-3 text-sm font-bold">{t.noSlotsToday}</p>
          )}
        </section>
      )}

      {/* A saved dish is missing from the menu or sold out: fix the cart first. */}
      {!orderable && (
        <section role="alert" className="mb-4 rounded-panel bg-warning-surface p-4 text-warning">
          <h2 className="text-base leading-snug font-extrabold">{t.cartNeedsReview}</h2>
          <ul className="mt-1 list-disc ps-5 text-sm">
            {cartLines.missingIds.length > 0 && <li>{t.missingItems(cartLines.missingIds.length)}</li>}
            {cartLines.soldOut.map((line) => (
              <li key={line.item.id}>{t.soldOutItem(itemName(line.item, locale))}</li>
            ))}
          </ul>
          <Link href="/cart" className={`${primaryButton} mt-3`}>
            {t.reviewCart}
          </Link>
        </section>
      )}

      {problem && !closed && (
        <div role="alert" className="mb-4 rounded-panel bg-error-surface p-4 text-sm font-semibold text-error">
          <p>{t[problem]}</p>
        </div>
      )}

      {/* The ticket: truck, time and total readable at a glance. */}
      <section aria-label={t.checkout} className="rounded-panel border border-divider p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{t.orderingFrom}</p>
            <p className="text-xl leading-tight font-extrabold">{name}</p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-sm font-semibold text-muted">{t.pickupTime}</p>
            <p aria-live="polite" className="text-xl leading-tight font-extrabold">
              {selected ? (
                <Isolate>{formatSlot(selected, locale)}</Isolate>
              ) : (
                <span className="text-base text-muted">{t.notChosen}</span>
              )}
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5 border-t border-dashed border-outline pt-3">
          {lines.map(({ item, quantity }) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span>
                <Isolate className="font-bold">{quantity} ×</Isolate> {itemName(item, locale)}
              </span>
              <Money amount={Number(item.price_kwd) * quantity} locale={locale} className="font-semibold" />
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-divider pt-3">
          <p>
            <span className="font-bold">{t.total}</span> <span className="text-sm text-muted">· {t.itemCount(count)}</span>
          </p>
          <Money amount={total} locale={locale} className="text-2xl font-extrabold" />
        </div>
      </section>

      {/* Slot picker: a real radio group, so arrow keys and screen readers work. */}
      {!closed && (
        <fieldset className="mt-6">
          <legend className="text-lg font-bold">{t.choosePickup}</legend>
          <p className="text-sm text-muted">{t.slotsNote}</p>

          {upcoming.length === 0 ? (
            <p className="mt-3 rounded-control bg-subtle p-3 font-semibold">{t.noSlotsToday}</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {upcoming.map((slot) => {
                const full = isFull(slot);
                const isSelected = slot.slot_start === selected;
                const left = slot.capacity - slot.booked;
                const note = full
                  ? slot.slot_start === lost?.slot
                    ? t.justFilled
                    : t.full
                  : slot.slot_start === suggestion && !selected
                    ? t.nextAvailable
                    : slot.slot_start === earliest && !noticeSlot
                      ? t.earliest
                      : t.placesLeft(left);
                return (
                  <label
                    key={slot.slot_start}
                    className={`relative flex min-h-16 flex-col justify-center rounded-control border px-3 py-2 transition-colors duration-[120ms] ease-out has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                      full
                        ? "cursor-not-allowed border-dashed border-outline bg-subtle text-muted"
                        : isSelected
                          ? "cursor-pointer border-ink bg-ink text-snowy-white"
                          : "cursor-pointer border-outline bg-snowy-white hover:border-ink hover:bg-subtle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pickup-slot"
                      value={slot.slot_start}
                      checked={isSelected}
                      disabled={full}
                      onChange={() => choose(slot.slot_start)}
                      className="sr-only"
                    />
                    <Isolate className={`text-lg leading-tight font-bold ${full ? "line-through" : ""}`}>
                      {formatSlot(slot.slot_start, locale)}
                    </Isolate>
                    <span className={`text-sm ${isSelected ? "text-snowy-white" : full ? "font-semibold" : "text-muted"}`}>
                      {isSelected ? t.selected : note}
                    </span>
                    {isSelected && <CheckIcon className="absolute end-2.5 top-2.5 size-5 text-yellow-punk" />}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {/* Payment: pay at pickup is the only method in this milestone. */}
      {!closed && (
        <section aria-labelledby="payment-heading" className="mt-6">
          <h2 id="payment-heading" className="text-lg font-bold">
            {t.payment}
          </h2>
          <div className="mt-2 flex items-center gap-3 rounded-control border-2 border-ink p-3">
            <StoreIcon className="size-6" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t.payAtPickup}</p>
              <p className="text-sm text-muted">{t.payAtPickupHint(name)}</p>
            </div>
            <CheckIcon className="size-5" />
          </div>
        </section>
      )}

      {session && (
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="min-w-0 break-all">{t.signedInAs(session.user.email ?? "")}</span>
          <button
            type="button"
            onClick={() => supabaseBrowser().auth.signOut()}
            className="min-h-11 font-bold text-ink underline underline-offset-4"
          >
            {t.signOut}
          </button>
        </p>
      )}

      {/* The one-handed action, pinned above the safe area. Its width never changes. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-snowy-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-xl px-4 py-3 md:px-6">
          {closed ? (
            <button type="button" disabled className={primaryButton}>
              {t.cannotPlace}
            </button>
          ) : !orderable ? (
            <button type="button" disabled className={primaryButton}>
              {t.fixCartFirst}
            </button>
          ) : sessionLoading ? (
            <button type="button" disabled className={primaryButton}>
              {t.loading}
            </button>
          ) : !session ? (
            <Link href="/sign-in?next=/checkout" className={primaryButton}>
              {t.signInToOrder}
              <ArrowForward className="size-5" />
            </Link>
          ) : (
            <button
              ref={placeButton}
              type="button"
              onClick={placeOrder}
              disabled={!selected}
              aria-busy={placing}
              className={primaryButtonSplit}
            >
              <span aria-live="polite">
                {placing ? (
                  t.placing
                ) : selected ? (
                  <>
                    {t.placeOrder} · <Isolate>{formatSlot(selected, locale)}</Isolate>
                  </>
                ) : (
                  t.chooseTimeFirst
                )}
              </span>
              <Money amount={total} locale={locale} />
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** Asks the server about this customer's unconfirmed attempt. Reads only. */
async function lookUpPending(
  customerId: string,
): Promise<
  | { result: "none" }
  | { result: "unknown"; pending: PendingOrder; last: "empty" | "failed" }
  | { result: "saved"; pending: PendingOrder; orderId: string }
> {
  const pending = readPending(customerId);
  if (!pending) return { result: "none" };
  try {
    const orderId = await findOrderForAttempt(supabaseBrowser(), pending);
    // No order YET is not "no order": the request may still be on its way.
    return orderId ? { result: "saved", pending, orderId } : { result: "unknown", pending, last: "empty" };
  } catch {
    return { result: "unknown", pending, last: "failed" };
  }
}

/** The truck's live slot counts and whether it is closed tonight. */
async function loadAvailability(truckId: string): Promise<{ slots: Slot[]; closed: boolean }> {
  const db = supabaseBrowser();
  const [slots, closed] = await Promise.all([fetchSlots(db, truckId), fetchClosed(db, truckId)]);
  return { slots, closed };
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="min-h-dvh">
      <AppHeader title={t.checkout} backHref="/cart" backLabel={t.back} />
      <main className="mx-auto max-w-xl px-4 pt-4 pb-32 md:px-6">{children}</main>
    </div>
  );
}
