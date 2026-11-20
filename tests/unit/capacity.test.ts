// Unit tests for the capacity setting's rules. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityImpact, clampCapacity, MAX_CAPACITY, MIN_CAPACITY, slotFit, takesNoMoreOrders } from "../../lib/capacity.ts";

test("capacity stays inside 1 to 20", () => {
  assert.equal(MIN_CAPACITY, 1);
  assert.equal(MAX_CAPACITY, 20);
  assert.equal(clampCapacity(0), 1);
  assert.equal(clampCapacity(-3), 1);
  assert.equal(clampCapacity(21), 20);
  assert.equal(clampCapacity(6), 6);
  assert.equal(clampCapacity(5.6), 6);
  assert.equal(clampCapacity(Number.NaN), 1);
});

test("five bookings: open at capacity six, full at five, over at four", () => {
  assert.equal(slotFit(5, 6), "open");
  assert.equal(slotFit(5, 5), "full");
  assert.equal(slotFit(5, 4), "over");
  assert.equal(takesNoMoreOrders(5, 6), false);
  assert.equal(takesNoMoreOrders(5, 5), true);
  assert.equal(takesNoMoreOrders(5, 4), true);
});

const tonight = [
  { slot_start: "19:00:00", booked: 4 },
  { slot_start: "19:15:00", booked: 5 },
  { slot_start: "19:30:00", booked: 6 },
  { slot_start: "19:45:00", booked: 2 },
  { slot_start: "20:00:00", booked: 0 },
];

test("lowering six to five: the time with five bookings becomes full, the one with six is over", () => {
  assert.deepEqual(capacityImpact(tonight, 6, 5), {
    becomesFull: ["19:15:00"],
    over: ["19:30:00"],
    reopens: [],
  });
});

test("lowering below existing bookings lists every time that ends up over the limit", () => {
  assert.deepEqual(capacityImpact(tonight, 6, 4), {
    becomesFull: ["19:00:00"],
    over: ["19:15:00", "19:30:00"],
    reopens: [],
  });
});

test("raising capacity reopens a full time; no change means nothing to report", () => {
  assert.deepEqual(capacityImpact(tonight, 6, 7), { becomesFull: [], over: [], reopens: ["19:30:00"] });
  assert.deepEqual(capacityImpact(tonight, 6, 6), { becomesFull: [], over: [], reopens: [] });
});

test("a time that was already over the limit is still reported as over", () => {
  assert.deepEqual(capacityImpact([{ slot_start: "19:30:00", booked: 6 }], 5, 4).over, ["19:30:00"]);
});
