// The park manager's dashboard rules, with no browser or database in them,
// so they can be unit-tested.
//
// Two different questions are kept apart on purpose:
//   1. How many places are taken?  -> the database's own count (slot_usage).
//   2. Can a customer still book?  -> bookingState() below.
// A slot can have free places and still be closed for booking, because the
// booking deadline (15 minutes before pickup) has passed.

import { countsTowardSlot, type KitchenOrder } from "./kitchen.ts";
import { LEAD_SECONDS, slotSeconds } from "./time.ts";

/** Tonight's 24 pickup slots: "17:00:00" to "22:45:00", 15 minutes apart. */
export const SLOT_STARTS: string[] = Array.from({ length: 24 }, (_, n) => {
  const minutes = 17 * 60 + n * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
});

/** "19:15" or "19:15:00" -> "19:15:00" when it is one of tonight's slots, else null. */
export function parseSlot(value: string | null | undefined): string | null {
  if (!value) return null;
  const full = value.length === 5 ? `${value}:00` : value;
  return SLOT_STARTS.includes(full) ? full : null;
}

/** The last moment a slot can be booked: 15 minutes before it starts. "19:15:00" -> "19:00:00". */
export function bookingDeadline(slot: string): string {
  const seconds = slotSeconds(slot) - LEAD_SECONDS;
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String((seconds % 3600) / 60).padStart(2, "0")}:00`;
}

/** Has this slot's booking deadline passed? `nowSeconds` is seconds into the Kuwait day. */
export function deadlinePassed(slot: string, nowSeconds: number): boolean {
  return slotSeconds(slot) < nowSeconds + LEAD_SECONDS;
}

/**
 * Why a customer can or cannot book this slot right now. The first reason
 * that applies wins, in the order the database checks them (place_order):
 * truck closed, then deadline, then capacity.
 */
export type BookingState = "truck_closed" | "deadline_passed" | "full" | "open";

export function bookingState(input: {
  slot: string;
  booked: number;
  capacity: number;
  truckClosed: boolean;
  nowSeconds: number;
}): BookingState {
  if (input.truckClosed) return "truck_closed";
  if (deadlinePassed(input.slot, input.nowSeconds)) return "deadline_passed";
  if (input.booked >= input.capacity) return "full";
  return "open";
}

/** The slot the dashboard opens on: the first one that has not started yet, else the last. */
export function currentSlot(nowSeconds: number): string {
  return SLOT_STARTS.find((slot) => slotSeconds(slot) >= nowSeconds) ?? SLOT_STARTS[SLOT_STARTS.length - 1];
}

/**
 * How strongly to tint a cell. 0 is empty, 4 is full. Colour only supports
 * the printed count; it never replaces it.
 */
export function busyLevel(booked: number, capacity: number): 0 | 1 | 2 | 3 | 4 {
  if (booked >= capacity) return 4;
  if (booked <= 0) return 0;
  const share = booked / capacity;
  if (share >= 0.8) return 3;
  if (share >= 0.5) return 2;
  return 1;
}

/**
 * The tickets behind one slot's count. `counted` are the orders that take a
 * place (every status except rejected and cancelled, so collected orders
 * stay in); `freed` are the rejected and cancelled ones, shown separately.
 */
export function explainSlot<T extends Pick<KitchenOrder, "truck_id" | "slot_start" | "status" | "placed_at" | "ticket_ref">>(
  orders: T[],
  truckId: string,
  slot: string,
): { counted: T[]; freed: T[] } {
  const here = orders
    .filter((order) => order.truck_id === truckId && order.slot_start === slot)
    .sort((a, b) => a.placed_at.localeCompare(b.placed_at) || a.ticket_ref.localeCompare(b.ticket_ref));
  return {
    counted: here.filter((order) => countsTowardSlot(order.status)),
    freed: here.filter((order) => !countsTowardSlot(order.status)),
  };
}

export type Cell = { truckId: string; slot: string; booked: number; capacity: number };

/**
 * The busiest truck and time tonight: the highest share of capacity taken.
 * Ties go to the earlier slot, then the truck listed first. Null when no
 * slot has an order yet.
 */
export function busiestCell(cells: Cell[]): Cell | null {
  let best: Cell | null = null;
  for (const cell of cells) {
    if (cell.booked <= 0) continue;
    // Compare booked/capacity without dividing: a/b > c/d  <=>  a*d > c*b.
    if (
      !best ||
      cell.booked * best.capacity > best.booked * cell.capacity ||
      (cell.booked * best.capacity === best.booked * cell.capacity && cell.slot < best.slot)
    ) {
      best = cell;
    }
  }
  return best;
}
