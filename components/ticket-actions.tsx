"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fetchRating, rateOrder, setOrderStatus, type Order, type Rating } from "@/lib/data";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { cleanComment, MAX_COMMENT, validStars } from "@/lib/ticket";
import { CheckIcon, primaryButton, secondaryButton, StarIcon } from "./ui";

type Saved = { id: string; status: string; rejection_reason: string | null };

/**
 * "Cancel order" and its confirmation, shown while the order is placed.
 *
 * The order is only shown as cancelled after the database answers
 * (set_order_status). If the truck accepted it at the same moment, the
 * database refuses the cancellation; the ticket then re-reads and shows
 * the status that was actually saved. Whichever came first wins.
 */
export function CancelOrder({
  order,
  time,
  truck,
  onCancelled,
  onTooLate,
}: {
  order: Order;
  time: string;
  truck: string;
  /** The database saved the cancellation. */
  onCancelled: (saved: Saved) => void;
  /** The database refused: the order is no longer "placed". */
  onTooLate: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const saved = await setOrderStatus(supabaseBrowser(), order.id, "cancelled");
      dialog.current?.close();
      onCancelled(saved);
    } catch (error) {
      if (error instanceof Error && error.message === "transition_not_allowed") {
        dialog.current?.close();
        onTooLate();
      } else {
        setFailed(true); // no clear answer: the order is still as it was
      }
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
          setFailed(false);
          dialog.current?.showModal();
          keep.current?.focus(); // focus starts on the safe choice
        }}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-error px-4 py-3 font-bold text-error transition-colors duration-[120ms] ease-out hover:bg-error-surface"
      >
        {t.cancelOrder}
      </button>
      <p className="text-center text-sm text-muted">{t.cancelHint}</p>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        onClose={() => opener.current?.focus()}
        onCancel={(event) => {
          if (busy) event.preventDefault(); // wait for the database's answer
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel bg-snowy-white p-5 text-ink backdrop:bg-ink/60"
      >
        <h2 id={`${id}-title`} className="text-2xl leading-tight font-extrabold text-balance">
          {t.cancelTitle(order.ticket_ref)}
        </h2>
        <p id={`${id}-body`} className="mt-3">
          {t.cancelBody(time, truck)}
        </p>
        {failed && (
          <p role="alert" className="mt-3 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
            {t.cancelFailed}
          </p>
        )}
        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy} aria-busy={busy} onClick={confirm} className={primaryButton}>
            <span aria-live="polite">{busy ? t.cancelling : failed ? `${t.retry}: ${t.cancelOrder}` : t.cancelOrder}</span>
          </button>
          <button ref={keep} type="button" disabled={busy} className={secondaryButton} onClick={() => dialog.current?.close()}>
            {t.keepOrder}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** Five stars, read out as "4 of 5 stars". */
function Stars({ stars, label }: { stars: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} filled={n <= stars} className={`size-7 ${n <= stars ? "text-ink" : "text-outline"}`} />
      ))}
    </span>
  );
}

/**
 * The rating for a collected order: 1 to 5 stars and an optional comment,
 * once.
 *
 * The saved rating is read from the database when the ticket opens, so a
 * refresh shows it again instead of the form. The database enforces every
 * rule (rate_order): own order, collected, 1 to 5 stars, once. If it
 * answers "already rated" (a second tab, a double tap), the ticket shows
 * the rating that was saved first.
 */
export function OrderRating({ orderId }: { orderId: string }) {
  const { t } = useLocale();
  const id = useId();
  const [saved, setSaved] = useState<{ loaded: boolean; rating: Rating | null }>({ loaded: false, rating: null });
  const [stars, setStars] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"stars" | "failed" | null>(null);
  const [note, setNote] = useState<"thanks" | "already" | null>(null);

  useEffect(() => {
    let current = true;
    fetchRating(supabaseBrowser(), orderId).then(
      (rating) => current && setSaved({ loaded: true, rating }),
      () => current && setSaved({ loaded: true, rating: null }),
    );
    return () => {
      current = false;
    };
  }, [orderId]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validStars(stars)) {
      setProblem("stars");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const rating = await rateOrder(supabaseBrowser(), orderId, stars, cleanComment(comment));
      setSaved({ loaded: true, rating });
      setNote("thanks");
    } catch (error) {
      if (error instanceof Error && error.message === "already_rated") {
        // Rated already (another tab, a double tap). Show what was saved.
        const rating = await fetchRating(supabaseBrowser(), orderId).catch(() => null);
        if (rating) {
          setSaved({ loaded: true, rating });
          setNote("already");
        } else setProblem("failed");
      } else setProblem("failed");
    } finally {
      setBusy(false);
    }
  }

  if (!saved.loaded) return <div role="status" aria-label={t.loading} className="mt-4 h-40 rounded-panel bg-subtle" />;

  if (saved.rating) {
    return (
      <section aria-labelledby={`${id}-title`} className="mt-4 rounded-panel border border-divider p-4">
        <h2 id={`${id}-title`} className="text-lg font-extrabold">
          {t.ratedTitle}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars stars={saved.rating.stars} label={t.ratedStars(saved.rating.stars)} />
          <span aria-hidden className="font-bold tabular-nums">
            {t.ratedStars(saved.rating.stars)}
          </span>
        </p>
        {saved.rating.comment && <p className="mt-2 wrap-anywhere whitespace-pre-line">{saved.rating.comment}</p>}
        <p role="status" className="mt-2 flex items-start gap-1.5 text-sm text-muted">
          {note === "thanks" && <CheckIcon className="mt-0.5 size-4" />}
          {note === "already" ? t.rateAlready : note === "thanks" ? t.ratedThanks : t.rateOnce}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="mt-4 rounded-panel border border-ink p-4">
      <h2 id={`${id}-title`} className="text-lg font-extrabold">
        {t.rateTitle}
      </h2>
      <form onSubmit={send} noValidate className="mt-2">
        <fieldset aria-describedby={problem === "stars" ? `${id}-stars-error` : undefined}>
          <legend className="text-sm font-semibold">{t.rateStarsLegend}</legend>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="relative flex size-12 cursor-pointer items-center justify-center rounded-control has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
              >
                <input
                  type="radio"
                  name={`${id}-stars`}
                  value={n}
                  checked={stars === n}
                  onChange={() => {
                    setStars(n);
                    setProblem(null);
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span className="sr-only">{t.starsLabel(n)}</span>
                <StarIcon
                  filled={stars !== null && n <= stars}
                  className={`size-9 ${stars !== null && n <= stars ? "text-ink" : "text-outline"}`}
                />
              </label>
            ))}
          </div>
          <p className="mt-1 min-h-5 text-sm font-bold tabular-nums" aria-live="polite">
            {stars !== null && t.ratedStars(stars)}
          </p>
        </fieldset>
        {problem === "stars" && (
          <p id={`${id}-stars-error`} role="alert" className="text-sm font-semibold text-error">
            {t.rateChooseStars}
          </p>
        )}

        <label htmlFor={`${id}-comment`} className="mt-3 block text-sm font-semibold">
          {t.rateComment}
        </label>
        <textarea
          id={`${id}-comment`}
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-describedby={`${id}-left`}
          className="mt-1 block w-full rounded-control border border-outline bg-snowy-white p-3 text-base text-ink"
        />
        <p id={`${id}-left`} className="mt-1 text-sm text-muted tabular-nums">
          {t.rateCommentLeft(MAX_COMMENT - comment.length)}
        </p>

        {problem === "failed" && (
          <p role="alert" className="mt-3 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
            {t.rateFailed}
          </p>
        )}
        <button type="submit" disabled={busy} aria-busy={busy} className={`${primaryButton} mt-3`}>
          <span aria-live="polite">{busy ? t.rateSending : problem === "failed" ? `${t.retry}: ${t.rateSend}` : t.rateSend}</span>
        </button>
        <p className="mt-2 text-sm text-muted">{t.rateOnce}</p>
      </form>
    </section>
  );
}
