// The capacity setting's rules, with no browser or database in them, so
// they can be unit-tested. The database enforces the range (a check on
// trucks.slot_capacity) and the limit itself (place_order); this file only
// decides what the settings screen shows.

export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 20;

/** Keeps a capacity inside 1 to 20. */
export function clampCapacity(value: number): number {
  if (!Number.isFinite(value)) return MIN_CAPACITY;
  return Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.round(value)));
}

/**
 * One pickup time measured against a capacity:
 * - open: places are left
 * - full: the orders reach the capacity exactly
 * - over: more orders than the capacity, because the capacity was lowered
 *         after they were placed. They all stay; the time takes no new ones.
 */
export type SlotFit = "open" | "full" | "over";

export function slotFit(booked: number, capacity: number): SlotFit {
  if (booked > capacity) return "over";
  if (booked === capacity) return "full";
  return "open";
}

/** A slot is closed to new orders when its orders reach the capacity (the brief's rule). */
export function takesNoMoreOrders(booked: number, capacity: number): boolean {
  return slotFit(booked, capacity) !== "open";
}

/**
 * What changing the capacity to `next` would do tonight. Only pickup times
 * whose state changes or that end up over the limit are listed.
 */
export function capacityImpact(
  slots: { slot_start: string; booked: number }[],
  saved: number,
  next: number,
): { becomesFull: string[]; over: string[]; reopens: string[] } {
  const becomesFull: string[] = [];
  const over: string[] = [];
  const reopens: string[] = [];
  for (const slot of slots) {
    const before = slotFit(slot.booked, saved);
    const after = slotFit(slot.booked, next);
    if (after === "over") over.push(slot.slot_start);
    else if (after === "full" && before === "open") becomesFull.push(slot.slot_start);
    else if (after === "open" && before !== "open") reopens.push(slot.slot_start);
  }
  return { becomesFull, over, reopens };
}
