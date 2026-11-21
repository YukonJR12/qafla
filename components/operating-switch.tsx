"use client";

import { useState } from "react";
import { setTruckOpen, type TruckState } from "@/lib/data";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { canSwitch, operating } from "@/lib/vendor-edits";
import { LockIcon } from "./ui";

/**
 * The vendor's own "Taking orders" switch on the Kitchen board.
 *
 * It is a different thing from the park manager's "Close for tonight":
 *   - this switch is the vendor's, and stays as set until they change it;
 *   - the manager's closure is for tonight only, and wins. While it is in
 *     force the switch is locked and says why.
 *
 * Pressing it asks the database to save the new setting and then shows what
 * the database answered. No order is touched either way.
 */
export function OperatingSwitch({
  truckId,
  state,
  onSaved,
}: {
  truckId: string;
  state: TruckState;
  /** The database saved a new setting. The board reads everything again. */
  onSaved: (isOpen: boolean) => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<"on" | "failed" | "not_yours" | null>(null);
  const mode = operating(state);
  const locked = !canSwitch(mode);
  const on = mode === "open";

  async function flip() {
    if (busy || locked) return;
    setBusy(true);
    setNote(null);
    try {
      const saved = await setTruckOpen(supabaseBrowser(), truckId, !state.isOpen);
      setNote(saved ? "on" : null);
      onSaved(saved);
    } catch (error) {
      setNote(error instanceof Error && error.message === "not_your_truck" ? "not_yours" : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-busy={busy}
        disabled={locked}
        onClick={flip}
        className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-ink bg-snowy-white py-1 ps-3 pe-1.5 font-bold transition-colors duration-[120ms] ease-out hover:bg-subtle disabled:cursor-not-allowed disabled:border-outline disabled:text-muted disabled:hover:bg-snowy-white"
      >
        <span>{t.takingOrdersSwitch}</span>
        {/* The track: lime with the knob at the end when on, plain with the knob at the start when off. */}
        <span
          aria-hidden
          className={`flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-[120ms] ease-out ${
            on ? "justify-end border-ink bg-yellow-punk" : "justify-start border-outline bg-subtle"
          }`}
        >
          <span className={`inline-flex size-5 items-center justify-center rounded-full ${on ? "bg-ink" : "bg-muted"}`}>
            {locked && <LockIcon className="size-3 text-snowy-white" />}
          </span>
        </span>
        {/* The state in words, so it never relies on the colour or the knob. */}
        <span className="min-w-10 pe-1.5 text-start">{busy ? t.saving : on ? t.switchOn : t.switchOff}</span>
      </button>

      {mode === "park" && <span className="rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white">{t.parkClosedLabel}</span>}

      {/* Switching off is explained by the board's own notice, so only "on again" is said here. */}
      <span role="status" className="text-sm font-semibold">
        {note === "on" && mode === "open" && t.switchedOn}
      </span>
      {(note === "failed" || note === "not_yours") && (
        <span role="alert" className="basis-full rounded-control bg-error-surface px-2.5 py-1.5 text-sm font-semibold text-error">
          {note === "not_yours" ? t.truckNotYours : t.switchFailed}
        </span>
      )}
    </div>
  );
}
