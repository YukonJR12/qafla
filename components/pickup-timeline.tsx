"use client";

import { useLocale } from "@/lib/locale";
import { useId, useState } from "react";
import { timeline, type Stage } from "@/lib/ticket";
import { CheckIcon, StageIcon } from "./ui";

/**
 * Order progress: Placed, Accepted, Preparing, Ready, Collected, as five
 * labelled tiles in a row.
 *
 * It is drawn from the confirmed order status and nothing else, so it can
 * never run ahead of what the database has saved. A finished stage has an
 * ink outline and a small check; the current stage is filled ink with a
 * Yellow Punk drawing and a bold label; a stage still to come is quiet.
 * Selecting a tile previews its explanation, never the order's status. The row
 * follows the page direction, so in Arabic it runs right to left.
 *
 * The five tiles share the width equally and their labels shrink with the
 * screen, so all five stay readable at 320 px in English and Arabic.
 *
 * A cancelled or rejected order has no stages; the ticket shows a final
 * message instead.
 */
export function PickupTimeline({ status, truck }: { status: string; truck: string }) {
  const { t } = useLocale();
  const captionId = useId();
  const [initialStatus] = useState(status);
  const [selection, setSelection] = useState<{ status: string; stage: Stage | null }>({ status, stage: null });
  // Reset before committing a render, so a live update replaces a preview in
  // one announcement. Re-reading the same status leaves the preview alone.
  if (selection.status !== status) setSelection({ status, stage: null });
  const selected = selection.status === status ? selection.stage ?? status : status;
  const preview = selected !== status;
  const stages = timeline(status);
  if (!stages) return null;

  return (
    <div>
      <ol aria-label={t.orderProgress} className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {stages.map(({ stage, state }, index) => {
          const name = t.statusName[stage] ?? stage;
          // The tile's own label is the short one ("Ready"), so five fit across a phone.
          const label = t.stageLabel[stage] ?? name;
          return (
            <li key={stage} className="relative min-w-0">
              {index < stages.length - 1 && <span aria-hidden className="stage-connector absolute top-6 start-full h-0.5 w-1.5 overflow-hidden bg-divider sm:w-2.5"><span className="block h-full bg-ink" style={{ transform: `scaleX(${state === "done" ? 1 : 0})` }} /></span>}
              <button
                type="button"
                aria-current={state === "current" ? "step" : undefined}
                aria-pressed={selected === stage}
                aria-controls={captionId}
                onClick={() => setSelection({ status, stage })}
                className="flex w-full min-w-0 flex-col items-center rounded-panel"
              >
                <span
                  aria-hidden
                  // Re-keyed when a stage becomes the current one, so it bumps once per status change.
                  key={state}
                  className={`relative flex h-12 w-full items-center justify-center rounded-panel border transition-colors duration-[180ms] ease-out ${
                    state === "current"
                      ? "border-ink bg-ink text-yellow-punk"
                      : state === "done"
                        ? "border-ink bg-snowy-white text-ink"
                        : "border-outline bg-snowy-white text-ink"
                  } ${preview && selected === stage ? "ring-2 ring-red-orange ring-offset-2 ring-offset-snowy-white" : ""}`}
                >
                  <StageIcon stage={stage} className="size-6" />
                  {state === "done" && (
                    <span className="absolute -end-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-ink text-snowy-white">
                      <CheckIcon className={`size-3 ${timeline(initialStatus)?.[index]?.state !== "done" ? "stage-check" : ""}`} />
                    </span>
                  )}
                </span>
                <span className="sr-only">
                  {state === "done" ? t.stageDone(name) : state === "current" ? t.stageCurrent(name) : t.stageTodo(name)}
                </span>
                <span
                  aria-hidden
                  className={`mt-1 max-w-full text-center text-[clamp(0.64rem,2.8vw,0.82rem)] leading-tight wrap-anywhere ${
                    state === "current" ? "font-extrabold text-ink" : "font-semibold text-ink"
                  }`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 rounded-control bg-subtle px-3 py-2.5 leading-snug font-semibold">
        {/* The ticket's only live stage announcement, including Ready. */}
        <p id={captionId} aria-live="polite" aria-atomic="true">
          {preview ? (
            <>
              <span className="mb-1 block text-sm font-extrabold">{t.stagePreview(t.stageLabel[selected] ?? selected)}</span>
              {t.stageExplanation[selected]}
            </>
          ) : (t.timelineCaption[status] ?? (() => t.statusName[status] ?? status))(truck)}
        </p>
        {preview && (
          <button type="button" className="mt-1 min-h-11 text-start text-sm font-extrabold underline underline-offset-4" onClick={() => setSelection({ status, stage: null })}>
            {t.backToCurrentStage}
          </button>
        )}
      </div>
    </div>
  );
}
