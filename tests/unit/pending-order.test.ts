// Unit tests for remembering an unconfirmed checkout attempt. Run with: pnpm test:unit
// A plain Map stands in for the browser's localStorage.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPending,
  outcomeOf,
  readPending,
  savePending,
  type KeyValueStore,
  type PendingOrder,
} from "../../lib/pending-order.ts";

function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const attempt = (customerId: string): PendingOrder => ({
  customerId,
  requestId: "5e0a0751-0000-4000-8000-000000000001",
  truckId: "T02",
  truckName: "Dune Burgers",
  slot: "19:15:00",
  items: { M201: 1, M204: 1 },
});

test("an attempt survives a refresh for the customer who made it", () => {
  const store = fakeStore();
  savePending(attempt("customer-a"), store);
  assert.deepEqual(readPending("customer-a", store), attempt("customer-a"));
});

test("a different customer on the same browser does not inherit it", () => {
  const store = fakeStore();
  savePending(attempt("customer-a"), store);
  assert.equal(readPending("customer-b", store), null);
  // ...and it is still there when the first customer comes back.
  assert.deepEqual(readPending("customer-a", store), attempt("customer-a"));
});

test("a record copied under another customer's key is ignored", () => {
  const store = fakeStore();
  savePending(attempt("customer-a"), store);
  const [[, raw]] = [...store.map.entries()];
  store.map.set("qafla.pending-order.v1.customer-b", raw);
  assert.equal(readPending("customer-b", store), null);
});

test("clearing removes only that customer's attempt", () => {
  const store = fakeStore();
  savePending(attempt("customer-a"), store);
  savePending(attempt("customer-b"), store);
  clearPending("customer-a", store);
  assert.equal(readPending("customer-a", store), null);
  assert.deepEqual(readPending("customer-b", store), attempt("customer-b"));
});

test("damaged storage reads as no attempt", () => {
  const store = fakeStore();
  store.map.set("qafla.pending-order.v1.customer-a", "{not json");
  assert.equal(readPending("customer-a", store), null);
});

test("a ticket is 'saved' and the server's own refusals are 'refused'", () => {
  assert.equal(outcomeOf({ data: { id: "o1" }, error: null }), "saved");
  for (const code of ["slot_full", "truck_closed", "slot_too_soon", "item_sold_out", "request_id_reused"]) {
    assert.equal(outcomeOf({ data: null, error: { message: code } }), "refused", code);
  }
});

test("anything else is 'unknown', because the order may have been saved", () => {
  assert.equal(outcomeOf({ data: null, error: { message: "network" } }), "unknown");
  assert.equal(outcomeOf({ data: null, error: { message: "TypeError: Failed to fetch" } }), "unknown");
  assert.equal(outcomeOf({ data: null, error: { message: "upstream request timeout" } }), "unknown");
  assert.equal(outcomeOf({ data: null, error: null }), "unknown");
});
