// The kitchen board's rules, with no browser or database in them, so they
// can be unit-tested. The database enforces the same moves
// (set_order_status); this file only decides what the board shows.

import type { Order } from "./data";

/** An order as the kitchen board reads it. */
export type KitchenOrder = Order & { placed_at: string };

export type OrderStatus = "placed" | "accepted" | "preparing" | "ready" | "collected" | "rejected" | "cancelled";

// Placed -> Accepted -> Preparing -> Ready -> Collected. One step at a time.
const NEXT: Record<string, OrderStatus | undefined> = {
  placed: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "collected",
};

/** The one status the vendor can move this order forward to, or null when it is finished. */
export function nextStatus(status: string): OrderStatus | null {
  return NEXT[status] ?? null;
}

/** Still on the board: it has a next kitchen action. */
export function isActive(status: string): boolean {
  return nextStatus(status) !== null;
}

/** Not handed to the counter yet. */
export function needsCooking(status: string): boolean {
  return status === "placed" || status === "accepted" || status === "preparing";
}

/** Takes a place in its pickup slot. Every order does, except rejected and cancelled ones. */
export function countsTowardSlot(status: string): boolean {
  return status !== "rejected" && status !== "cancelled";
}

export type SlotGroup = {
  /** "19:15:00" */
  slot: string;
  /** Tickets that still need a kitchen action, oldest first. */
  orders: KitchenOrder[];
  /** Places taken in this slot, counted the way the database counts them. */
  booked: number;
};

/**
 * Tonight's tickets as the board shows them: one group per pickup time that
 * still has work in it, earliest first, plus the tickets that are finished.
 * Slot times are "HH:MM:SS" in Kuwait time, so sorting them as text is
 * sorting them by time.
 */
export function groupBySlot(orders: KitchenOrder[]): { groups: SlotGroup[]; finished: KitchenOrder[] } {
  const byOldest = (a: KitchenOrder, b: KitchenOrder) =>
    a.placed_at.localeCompare(b.placed_at) || a.ticket_ref.localeCompare(b.ticket_ref);

  const slots = new Map<string, SlotGroup>();
  for (const order of orders) {
    const group = slots.get(order.slot_start) ?? { slot: order.slot_start, orders: [], booked: 0 };
    if (isActive(order.status)) group.orders.push(order);
    if (countsTowardSlot(order.status)) group.booked += 1;
    slots.set(order.slot_start, group);
  }

  const groups = [...slots.values()]
    .filter((group) => group.orders.length > 0)
    .sort((a, b) => a.slot.localeCompare(b.slot));
  for (const group of groups) group.orders.sort(byOldest);

  const finished = orders
    .filter((order) => !isActive(order.status))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start) || byOldest(a, b));

  return { groups, finished };
}
