"use client";

import { useId, useRef, useState } from "react";
import { setOrderStatus } from "@/lib/data";
import { itemName } from "@/lib/i18n";
import { nextStatus, type KitchenOrder, type OrderStatus } from "@/lib/kitchen";
import { useLocale } from "@/lib/locale";
import { canAccept, paymentView } from "@/lib/payments";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";
import { CheckIcon, Isolate, Money, primaryButtonSplit, secondaryButton, primaryButton } from "./ui";

/** How each kitchen status looks. The word is always shown; colour only supports it. */
const STATUS_STYLE: Record<string, string> = {
  placed: "bg-ink text-snowy-white",
  accepted: "border border-outline bg-snowy-white text-ink",
  preparing: "bg-warning-surface text-warning",
  ready: "border border-ink bg-yellow-punk text-ink",
  collected: "bg-subtle text-muted",
  rejected: "bg-error-surface text-error",
  cancelled: "bg-subtle text-muted",
};

export function StatusChip({ status }: { status: string }) {
  const { t } = useLocale();
  return (
    <span className={`inline-flex shrink-0 items-center rounded-control px-2.5 py-1 text-sm font-bold ${STATUS_STYLE[status] ?? "bg-subtle"}`}>
      {t.statusName[status] ?? status}
    </span>
  );
}

/** The answers that mean "this ticket is not in the status you thought". */
const STALE = new Set(["transition_not_allowed", "order_not_found", "payment_not_confirmed"]);

type Saved = { id: string; status: string; rejection_reason: string | null };

/**
 * One order on the kitchen board: pickup time, reference, what to cook, and
 * the one next action.
 *
 * The status shown is always the last one the database confirmed. Tapping
 * an action does not change it; only the database's answer does. If no
 * answer comes back, the ticket stays as it was and offers the same action
 * again.
 */
export function KitchenTicket({
  order,
  onConfirmed,
  onStale,
}: {
  order: KitchenOrder;
  /** The database saved a new status for this order. */
  onConfirmed: (saved: Saved) => void;
  /** The ticket moved underneath us (another device, or the customer cancelled). Re-read it. */
  onStale: () => void;
}) {
  const { locale, t } = useLocale();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [problem, setProblem] = useState<
    { kind: "failed"; target: OrderStatus; reason?: string } | { kind: "changed" } | null
  >(null);
  const [reasonMissing, setReasonMissing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  const next = nextStatus(order.status);
  const pay = paymentView(order);
  const waitingForPayment = order.status === "placed" && !canAccept(order);
  const time = formatSlot(order.slot_start, locale);

  async function move(target: OrderStatus, reason?: string) {
    if (busy) return;
    setBusy(target);
    setProblem(null);
    try {
      onConfirmed(await setOrderStatus(supabaseBrowser(), order.id, target, reason));
    } catch (error) {
      if (STALE.has(error instanceof Error ? error.message : "")) {
        setProblem({ kind: "changed" });
        onStale();
      } else {
        // No clear answer. The ticket keeps its last confirmed status.
        setProblem({ kind: "failed", target, reason });
      }
    } finally {
      setBusy(null);
    }
  }

  function submitRejection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = reasonField.current?.value.trim() ?? "";
    if (!reason) {
      setReasonMissing(true);
      reasonField.current?.focus();
      return;
    }
    dialog.current?.close();
    move("rejected", reason);
  }

  return (
    <article
      aria-label={t.ticketLabel(order.ticket_ref, time)}
      className="flex flex-col rounded-panel border border-ink bg-snowy-white p-4"
    >
      {/* Pickup time, reference and kitchen status. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-dashed border-outline pb-3">
        <div className="min-w-0">
          <p className="text-3xl leading-none font-extrabold tracking-tight">
            <Isolate>{time}</Isolate>
          </p>
          <p className="mt-1.5 text-sm font-bold text-muted">
            <Isolate>{order.ticket_ref}</Isolate>
          </p>
        </div>
        <StatusChip status={order.status} />
      </div>

      {/* What to cook. Quantities first, in a block that reads from across the counter. */}
      <ul className="space-y-2 py-3">
        {order.order_items.map((line) => (
          <li key={line.item_id} className="flex items-center gap-2.5 text-lg leading-snug font-bold">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-ink text-base font-extrabold text-snowy-white tabular-nums">
              {line.quantity}
            </span>
            <span className="min-w-0 wrap-anywhere">{itemName({ id: line.item_id, name: line.item_name }, locale)}</span>
          </li>
        ))}
      </ul>

      {/* Payment is its own, quieter line: it is not a kitchen status. */}
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-divider pt-3 text-sm text-muted">
        <Money amount={order.total_kwd} locale={locale} className="font-bold text-ink" />
        <span
          className={`rounded-control px-2 py-0.5 font-bold ${
            pay === "paid" ? "bg-ink text-snowy-white" : pay === "refund_due" ? "bg-warning-surface text-warning" : "bg-subtle text-ink"
          }`}
        >
          {t.paymentLabel[pay]}
        </span>
      </p>
      {/* The kitchen starts on an online order only once it is paid. The database enforces it. */}
      {waitingForPayment && <p className="mt-2 text-sm font-semibold text-warning">{t.awaitingPaymentHint}</p>}

      {problem && (
        <p role="alert" className="mt-3 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
          {problem.kind === "changed" ? t.ticketChanged : t.actionFailed(t.statusName[order.status] ?? order.status)}
        </p>
      )}

      {next && (
        <div className="mt-3 flex flex-wrap-reverse gap-2">
          {order.status === "placed" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setReasonMissing(false);
                dialog.current?.showModal();
              }}
              className={`${secondaryButton} w-auto! grow basis-24`}
            >
              {busy === "rejected" ? t.saving : t.reject}
            </button>
          )}
          {/* The one next kitchen action. Its width never changes while it saves. */}
          <button
            type="button"
            disabled={busy !== null || waitingForPayment}
            aria-busy={busy === next}
            onClick={() => move(next)}
            className={`${primaryButtonSplit} w-auto! grow-[3] basis-44`}
          >
            <span aria-live="polite">
              {busy === next
                ? t.saving
                : problem?.kind === "failed" && problem.target === next
                  ? `${t.retry}: ${t.kitchenAction[next]}`
                  : t.kitchenAction[next]}
            </span>
            {next === "ready" && <CheckIcon className="size-5" />}
          </button>
          {/* A rejection that did not save can be sent again with the same reason. */}
          {problem?.kind === "failed" && problem.target === "rejected" && order.status === "placed" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => move("rejected", problem.reason)}
              className={`${secondaryButton} basis-full`}
            >
              {t.retry}: {t.kitchenAction.rejected}
            </button>
          )}
        </div>
      )}

      {/* Closing the dialog returns focus to the Reject button (native <dialog> behaviour). */}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-panel bg-snowy-white p-5 text-ink"
      >
        <form onSubmit={submitRejection} noValidate>
          <h2 id={`${id}-title`} className="text-xl font-extrabold">
            {t.rejectTitle(order.ticket_ref)}
          </h2>
          <label htmlFor={`${id}-reason`} className="mt-3 block text-sm font-semibold">
            {t.rejectReasonLabel}
          </label>
          <textarea
            id={`${id}-reason`}
            ref={reasonField}
            rows={2}
            maxLength={200}
            aria-invalid={reasonMissing}
            aria-describedby={reasonMissing ? `${id}-error` : undefined}
            onInput={() => setReasonMissing(false)}
            className="mt-1 block w-full rounded-control border border-outline bg-snowy-white p-3 text-base text-ink"
          />
          {reasonMissing && (
            <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-error">
              {t.rejectReasonRequired}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {t.rejectQuickReasons.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  if (reasonField.current) reasonField.current.value = reason;
                  setReasonMissing(false);
                }}
                className="min-h-11 rounded-full border border-outline px-3 text-start text-sm font-semibold hover:border-ink hover:bg-subtle"
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            <button type="submit" className={primaryButton}>
              {t.kitchenAction.rejected}
            </button>
            <button type="button" className={secondaryButton} onClick={() => dialog.current?.close()}>
              {t.keepOrder}
            </button>
          </div>
        </form>
      </dialog>
    </article>
  );
}
