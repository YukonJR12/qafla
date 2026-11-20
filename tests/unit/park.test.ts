// Unit tests for the park manager's dashboard rules. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingDeadline,
  bookingState,
  busiestCell,
  busyLevel,
  currentSlot,
  deadlinePassed,
  explainSlot,
  parseSlot,
  SLOT_STARTS,
} from "../../lib/park.ts";

const at = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 3600 + m * 60;
};

test("tonight has 24 pickup times, 5:00 PM to 10:45 PM, 15 minutes apart", () => {
  assert.equal(SLOT_STARTS.length, 24);
  assert.equal(SLOT_STARTS[0], "17:00:00");
  assert.equal(SLOT_STARTS[9], "19:15:00");
  assert.equal(SLOT_STARTS[23], "22:45:00");
});

test("a time from the address bar is only accepted when it is one of tonight's slots", () => {
  assert.equal(parseSlot("19:15"), "19:15:00");
  assert.equal(parseSlot("19:15:00"), "19:15:00");
  assert.equal(parseSlot("19:10"), null);
  assert.equal(parseSlot("23:00"), null);
  assert.equal(parseSlot("nonsense"), null);
  assert.equal(parseSlot(null), null);
});

test("booking closes 15 minutes before pickup", () => {
  assert.equal(bookingDeadline("19:15:00"), "19:00:00");
  assert.equal(bookingDeadline("17:00:00"), "16:45:00");
  assert.equal(deadlinePassed("19:15:00", at("19:00")), false); // exactly 15 minutes ahead still books
  assert.equal(deadlinePassed("19:15:00", at("19:00") + 1), true);
  assert.equal(deadlinePassed("19:15:00", at("19:06")), true);
  assert.equal(deadlinePassed("19:30:00", at("19:06")), false);
});

test("a slot with a free place whose deadline passed is 'deadline passed', not 'full'", () => {
  const five = { slot: "19:15:00", booked: 5, capacity: 6, truckClosed: false };
  assert.equal(bookingState({ ...five, nowSeconds: at("19:06") }), "deadline_passed");
  assert.equal(bookingState({ ...five, nowSeconds: at("18:00") }), "open");
});

test("a full slot that can still be booked in time is 'full'", () => {
  const six = { slot: "19:30:00", booked: 6, capacity: 6, truckClosed: false };
  assert.equal(bookingState({ ...six, nowSeconds: at("19:06") }), "full");
  // Full and past its deadline: the deadline is the reason given, as in place_order.
  assert.equal(bookingState({ ...six, nowSeconds: at("19:20") }), "deadline_passed");
});

test("a closed truck takes no bookings, whatever the count or the time", () => {
  assert.equal(
    bookingState({ slot: "21:00:00", booked: 0, capacity: 6, truckClosed: true, nowSeconds: at("17:00") }),
    "truck_closed",
  );
});

test("the dashboard opens on the next pickup time that has not started", () => {
  assert.equal(currentSlot(at("13:00")), "17:00:00");
  assert.equal(currentSlot(at("19:06")), "19:15:00");
  assert.equal(currentSlot(at("19:15")), "19:15:00");
  assert.equal(currentSlot(at("23:30")), "22:45:00");
});

test("5 of 6 and 6 of 6 never look the same", () => {
  assert.equal(busyLevel(0, 6), 0);
  assert.equal(busyLevel(2, 6), 1);
  assert.equal(busyLevel(3, 6), 2);
  assert.equal(busyLevel(5, 6), 3);
  assert.equal(busyLevel(6, 6), 4);
  assert.equal(busyLevel(7, 6), 4); // capacity lowered after orders were placed
  assert.notEqual(busyLevel(5, 6), busyLevel(6, 6));
});

let n = 0;
function ticket(truck: string, slot: string, status: string) {
  n += 1;
  return {
    ticket_ref: `${truck}-${String(n).padStart(6, "0")}`,
    truck_id: truck,
    slot_start: slot,
    status,
    placed_at: `2026-11-20T14:00:${String(n).padStart(2, "0")}Z`,
  };
}

test("the tickets behind a count: collected still counts, rejected and cancelled do not", () => {
  const orders = [
    ticket("T02", "19:15:00", "preparing"),
    ticket("T02", "19:15:00", "ready"),
    ticket("T02", "19:15:00", "collected"),
    ticket("T02", "19:15:00", "accepted"),
    ticket("T02", "19:15:00", "placed"),
    ticket("T02", "19:15:00", "cancelled"),
    ticket("T02", "19:15:00", "rejected"),
    ticket("T02", "19:30:00", "placed"), // another time
    ticket("T03", "19:15:00", "placed"), // another truck
  ];
  const { counted, freed } = explainSlot(orders, "T02", "19:15:00");
  assert.equal(counted.length, 5);
  assert.deepEqual(
    counted.map((order) => order.status),
    ["preparing", "ready", "collected", "accepted", "placed"],
  );
  assert.deepEqual(
    freed.map((order) => order.status),
    ["cancelled", "rejected"],
  );
  assert.deepEqual(explainSlot(orders, "T02", "20:00:00"), { counted: [], freed: [] });
});

test("the busiest cell is the highest share of capacity; ties go to the earlier time", () => {
  assert.equal(busiestCell([]), null);
  assert.equal(busiestCell([{ truckId: "T01", slot: "17:00:00", booked: 0, capacity: 10 }]), null);
  const cells = [
    { truckId: "T01", slot: "19:15:00", booked: 7, capacity: 10 }, // 70%
    { truckId: "T02", slot: "19:15:00", booked: 5, capacity: 6 }, // 83%
    { truckId: "T02", slot: "19:30:00", booked: 6, capacity: 6 }, // 100%
    { truckId: "T03", slot: "19:45:00", booked: 6, capacity: 6 }, // 100%, later
  ];
  assert.deepEqual(busiestCell(cells), cells[2]);
  assert.deepEqual(busiestCell(cells.slice(0, 2)), cells[1]);
});
