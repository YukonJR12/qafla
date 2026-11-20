// Unit tests for the customer ticket's rules. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { canCancel, canRate, cleanComment, MAX_COMMENT, STAGES, timeline, validStars } from "../../lib/ticket.ts";

const states = (status: string) => timeline(status)?.map((s) => s.state);

test("the timeline has five stages in the order the kitchen works", () => {
  assert.deepEqual([...STAGES], ["placed", "accepted", "preparing", "ready", "collected"]);
});

test("earlier stages are done, the confirmed status is current, later ones are still to come", () => {
  assert.deepEqual(states("placed"), ["current", "todo", "todo", "todo", "todo"]);
  assert.deepEqual(states("accepted"), ["done", "current", "todo", "todo", "todo"]);
  assert.deepEqual(states("preparing"), ["done", "done", "current", "todo", "todo"]);
  assert.deepEqual(states("ready"), ["done", "done", "done", "current", "todo"]);
});

test("a collected order has every stage done and nothing current", () => {
  assert.deepEqual(states("collected"), ["done", "done", "done", "done", "done"]);
});

test("exactly one stage is current until the order is collected", () => {
  for (const status of ["placed", "accepted", "preparing", "ready"]) {
    assert.equal(states(status)?.filter((s) => s === "current").length, 1, status);
  }
});

test("cancelled and rejected orders have no timeline, only their final message", () => {
  assert.equal(timeline("cancelled"), null);
  assert.equal(timeline("rejected"), null);
  assert.equal(timeline("something-else"), null);
});

test("cancelling is offered only while the order is placed", () => {
  assert.equal(canCancel("placed"), true);
  for (const status of ["accepted", "preparing", "ready", "collected", "rejected", "cancelled"]) {
    assert.equal(canCancel(status), false, status);
  }
});

test("rating is offered only for a collected order that has no rating", () => {
  assert.equal(canRate("collected", false), true);
  assert.equal(canRate("collected", true), false);
  assert.equal(canRate("ready", false), false);
  assert.equal(canRate("cancelled", false), false);
});

test("stars are a whole number from 1 to 5", () => {
  for (const n of [1, 2, 3, 4, 5]) assert.equal(validStars(n), true);
  for (const n of [0, 6, -1, 2.5, Number.NaN]) assert.equal(validStars(n), false);
  assert.equal(validStars(null), false);
});

test("an empty comment is saved as no comment", () => {
  assert.equal(cleanComment(""), null);
  assert.equal(cleanComment("  \n "), null);
  assert.equal(cleanComment("  Hot and fast.  "), "Hot and fast.");
  assert.equal(MAX_COMMENT, 500);
});
