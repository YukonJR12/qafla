// How the customer's Orders list is sorted into "active" and "past", with no
// browser or database in it, so it can be unit-tested.

/** Statuses a truck is still working on. */
const IN_PROGRESS = new Set(["placed", "accepted", "preparing", "ready"]);

type Listed = { service_date: string; slot_start: string; status: string; placed_at: string };

/**
 * An order is active when the truck is still working on it AND it is for
 * tonight (Kuwait date). An unfinished order from an earlier night can no
 * longer be collected, so it is listed with the past orders.
 */
export function isActive(order: Listed, today: string): boolean {
  return IN_PROGRESS.has(order.status) && order.service_date === today;
}

/**
 * Active orders, earliest pickup first (the next one to collect leads).
 * Past orders, newest first.
 */
export function splitOrders<T extends Listed>(orders: T[], today: string): { active: T[]; past: T[] } {
  const active = orders
    .filter((order) => isActive(order, today))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start) || a.placed_at.localeCompare(b.placed_at));
  const past = orders
    .filter((order) => !isActive(order, today))
    .sort((a, b) => b.service_date.localeCompare(a.service_date) || b.placed_at.localeCompare(a.placed_at));
  return { active, past };
}
