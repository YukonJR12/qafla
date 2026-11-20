// The customer ticket's rules, with no browser or database in them, so they
// can be unit-tested. The database enforces every one of them
// (set_order_status, rate_order); this file only decides what the ticket shows.

/** The five stages a ticket moves through, in order. */
export const STAGES = ["placed", "accepted", "preparing", "ready", "collected"] as const;
export type Stage = (typeof STAGES)[number];

export type StageState = "done" | "current" | "todo";

/**
 * The pickup timeline for a confirmed status.
 * - Stages before the status are done.
 * - The status itself is the current stage, except "collected": there is
 *   nothing left to wait for, so every stage is done.
 * - A cancelled or rejected order has no timeline (null). The ticket shows
 *   its own final message instead.
 */
export function timeline(status: string): { stage: Stage; state: StageState }[] | null {
  const at = STAGES.indexOf(status as Stage);
  if (at === -1) return null;
  const finished = status === "collected";
  return STAGES.map((stage, index) => ({
    stage,
    state: index < at || finished ? "done" : index === at ? "current" : "todo",
  }));
}

/** A customer can cancel only while the order is still "placed". */
export function canCancel(status: string): boolean {
  return status === "placed";
}

/** A rating is offered for a collected order that has none yet. */
export function canRate(status: string, hasRating: boolean): boolean {
  return status === "collected" && !hasRating;
}

export const MAX_COMMENT = 500;

/** Stars are a whole number from 1 to 5. */
export function validStars(stars: number | null): stars is number {
  return stars !== null && Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

/** The comment as it will be saved: trimmed, or null when it is empty. */
export function cleanComment(comment: string): string | null {
  const trimmed = comment.trim();
  return trimmed === "" ? null : trimmed;
}
