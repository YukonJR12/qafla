"use client";

import { useLocale } from "@/lib/locale";
import { timeline } from "@/lib/ticket";
import { CheckIcon, StageIcon } from "./ui";

/**
 * Order progress: Placed, Accepted, Preparing, Ready, Collected, as five
 * labelled tiles in a row.
 *
 * It is drawn from the confirmed order status and nothing else, so it can
 * never run ahead of what the database has saved. A finished stage has an
 * ink outline and a small check; the current stage is filled ink with a
 * Yellow Punk drawing and a bold label; a stage still to come is quiet.
 * One caption underneath says in plain words what is happening. The row
 * follows the page direction, so in Arabic it runs right to left.
 *
 * The five tiles share the width equally and their labels shrink with the
 * screen, so all five stay readable at 320 px in English and Arabic.
 *
 * A cancelled or rejected order has no stages; the ticket shows a final
 * message instead.
 */
export function PickupTimeline({ status, truck, announce }: { status: string; truck: string; announce: boolean }) {
  const { t } = useLocale();
  const stages = timeline(status);
  if (!stages) return null;

  return (
    <div>
      <ol aria-label={t.orderProgress} className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {stages.map(({ stage, state }) => {
          const name = t.statusName[stage] ?? stage;
          // The tile's own label is the short one ("Ready"), so five fit across a phone.
          const label = t.stageLabel[stage] ?? name;
          return (
            <li key={stage} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col items-center">
              <span
                aria-hidden
                // Re-keyed when a stage becomes the current one, so it bumps once per status change.
                key={state}
                className={`relative flex h-12 w-full items-center justify-center rounded-panel border transition-colors duration-[180ms] ease-out ${
                  state === "current"
                    ? "bump border-ink bg-ink text-yellow-punk"
                    : state === "done"
                      ? "border-ink bg-snowy-white text-ink"
                      : "border-outline bg-snowy-white text-ink"
                }`}
              >
                <StageIcon stage={stage} className="size-6" />
                {state === "done" && (
                  <span className="absolute -end-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-ink text-snowy-white">
                    <CheckIcon className="size-3" />
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
            </li>
          );
        })}
      </ol>

      {/* One caption in plain words. The ready notice already announces "ready". */}
      <p className="mt-3 rounded-control bg-subtle px-3 py-2.5 leading-snug font-semibold" aria-live={announce ? "polite" : "off"}>
        {(t.timelineCaption[status] ?? (() => t.statusName[status] ?? status))(truck)}
      </p>
    </div>
  );
}
