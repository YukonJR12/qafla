"use client";

import { Fragment } from "react";
import { useLocale } from "@/lib/locale";
import { timeline } from "@/lib/ticket";
import { CheckIcon } from "./ui";

/**
 * The pickup timeline: Placed, Accepted, Preparing, Ready, Collected.
 *
 * It is drawn from the confirmed order status and nothing else, so it can
 * never run ahead of what the database has saved. A finished stage has a
 * check, the current stage has a Red Orange ring, and one caption says in
 * plain words what is happening. The row follows the page direction, so in
 * Arabic it runs right to left by itself.
 *
 * A cancelled or rejected order has no timeline; the ticket shows a final
 * message instead.
 */
export function PickupTimeline({ status, truck, announce }: { status: string; truck: string; announce: boolean }) {
  const { t } = useLocale();
  const stages = timeline(status);
  if (!stages) return null;

  return (
    <div className="mt-5">
      <ol aria-label={t.orderProgress} className="flex items-center">
        {stages.map(({ stage, state }, index) => {
          const name = t.statusName[stage] ?? stage;
          return (
            <Fragment key={stage}>
              {/* The line between two markers is solid once the later stage is reached. */}
              {index > 0 && (
                <li
                  aria-hidden
                  className={`h-0.5 min-w-2 flex-1 transition-colors duration-[180ms] ease-out motion-reduce:transition-none ${
                    state === "todo" ? "bg-divider" : "bg-ink"
                  }`}
                />
              )}
              <li aria-current={state === "current" ? "step" : undefined} className="relative flex flex-col items-center">
                <span
                  aria-hidden
                  className={`flex size-8 items-center justify-center rounded-full transition-colors duration-[180ms] ease-out motion-reduce:transition-none ${
                    state === "done"
                      ? "bg-ink text-snowy-white"
                      : state === "current"
                        ? "border-4 border-red-orange bg-snowy-white"
                        : "border-2 border-divider bg-snowy-white"
                  }`}
                >
                  {state === "done" && <CheckIcon className="size-4.5" />}
                  {state === "current" && <span className="size-2.5 rounded-full bg-ink" />}
                </span>
                <span className="sr-only">
                  {state === "done" ? t.stageDone(name) : state === "current" ? t.stageCurrent(name) : t.stageTodo(name)}
                </span>
                {/* Stage names fit under the markers from 480 px. Narrower screens rely on the caption. */}
                <span
                  aria-hidden
                  className={`absolute top-full mt-1 hidden text-xs whitespace-nowrap min-[480px]:block ${
                    state === "current" ? "font-extrabold" : state === "done" ? "font-semibold" : "text-muted"
                  }`}
                >
                  {name}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {/* One caption, readable at 320 px. The ready notice already announces "ready". */}
      <p className="mt-3 text-base leading-snug font-bold min-[480px]:mt-8" aria-live={announce ? "polite" : "off"}>
        {(t.timelineCaption[status] ?? (() => t.statusName[status] ?? status))(truck)}
      </p>
    </div>
  );
}
