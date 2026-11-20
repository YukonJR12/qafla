// Unit tests for the kitchen board's rules. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { countsTowardSlot, groupBySlot, isActive, needsCooking, nextStatus, type KitchenOrder } from "../../lib/kitchen.ts";

let n = 0;
function ticket(slot: string, status: string, placedAt = "2026-11-20T14:00:00Z"): KitchenOrder {
  n += 1;
  return {
    id: `order-${n}`,
    ticket_ref: `T02-${String(n).padStart(6, "0")}`,
    truck_id: "T02",
    service_date: "2026-11-20",
    slot_start: slot,
    status,
    payment_method: "pay_at_pickup",
    total_kwd: 3.2,
    rejection_reason: null,
    trucks: { id: "T02", name: "Dune Burgers" },
    order_items: [],
    placed_at: placedAt,
  };
}

test("the kitchen moves an order one step at a time, and only forward", () => {
  assert.equal(nextStatus("placed"), "accepted");
  assert.equal(nextStatus("accepted"), "preparing");
  assert.equal(nextStatus("preparing"), "ready");
  assert.equal(nextStatus("ready"), "collected");
});

test("finished orders have no next action", () => {
  for (const status of ["collected", "rejected", "cancelled", "something-new"]) {
    assert.equal(nextStatus(status), null, status);
    assert.equal(isActive(status), false, status);
  }
});

test("a ready order is still on the board but no longer needs cooking", () => {
  assert.equal(isActive("ready"), true);
  assert.equal(needsCooking("ready"), false);
  assert.deepEqual(["placed", "accepted", "preparing"].map(needsCooking), [true, true, true]);
});

test("every order takes a place in its slot except rejected and cancelled ones", () => {
  assert.deepEqual(
    ["placed", "accepted", "preparing", "ready", "collected", "rejected", "cancelled"].map(countsTowardSlot),
    [true, true, true, true, true, false, false],
  );
});

test("tickets are grouped by pickup time, earliest first, oldest order first inside a group", () => {
  const late = ticket("19:30:00", "placed");
  const second = ticket("19:15:00", "preparing", "2026-11-20T14:05:00Z");
  const first = ticket("19:15:00", "accepted", "2026-11-20T14:01:00Z");
  const { groups } = groupBySlot([late, second, first]);
  assert.deepEqual(groups.map((g) => g.slot), ["19:15:00", "19:30:00"]);
  assert.deepEqual(groups[0].orders.map((o) => o.id), [first.id, second.id]);
});

test("marking a ticket collected takes it off the board but keeps its place in the slot count", () => {
  const cooking = ticket("19:15:00", "preparing");
  const collected = ticket("19:15:00", "collected");
  const rejected = ticket("19:15:00", "rejected");
  const { groups, finished } = groupBySlot([cooking, collected, rejected]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].orders.map((o) => o.id), [cooking.id]);
  assert.equal(groups[0].booked, 2); // cooking + collected; the rejected one freed its place
  assert.deepEqual(finished.map((o) => o.id).sort(), [collected.id, rejected.id].sort());
});

test("a pickup time whose tickets are all finished has no group", () => {
  const { groups, finished } = groupBySlot([ticket("18:00:00", "collected"), ticket("18:00:00", "cancelled")]);
  assert.deepEqual(groups, []);
  assert.equal(finished.length, 2);
});

test("no orders gives an empty board", () => {
  assert.deepEqual(groupBySlot([]), { groups: [], finished: [] });
});
