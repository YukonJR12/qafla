// Unit tests for "one cart per account on a shared device", and for how the
// Orders list is sorted. Run with: pnpm test:unit
// A plain Map stands in for the browser's localStorage.

import assert from "node:assert/strict";
import { test } from "node:test";
import { cartKey, dropLegacyCart, LEGACY_CART_KEY, readCart, writeCart, type Cart, type KeyValueStore } from "../../lib/cart-store.ts";
import { splitOrders } from "../../lib/orders.ts";

function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const burgers: Cart = { truckId: "T02", truckName: "Dune Burgers", items: { M201: 1, M204: 1 }, slot: "19:15:00" };
const tacos: Cart = { truckId: "T03", truckName: "Taco Saha", items: { M301: 2 }, slot: null };

test("each account reads back only its own cart", () => {
  const store = fakeStore();
  writeCart(store, A, burgers);
  assert.equal(readCart(store, B), null, "B signs in on the same phone and has no cart");

  writeCart(store, B, tacos);
  assert.deepEqual(readCart(store, A)?.items, { M201: 1, M204: 1 });
  assert.equal(readCart(store, A)?.slot, "19:15:00");
  assert.deepEqual(readCart(store, B)?.items, { M301: 2 });
  assert.equal(store.map.size, 2);
});

test("signed out, there is no cart to read and nothing is written", () => {
  const store = fakeStore();
  writeCart(store, A, burgers);
  assert.equal(readCart(store, null), null);
  writeCart(store, null, tacos);
  assert.equal(store.map.size, 1);
  assert.deepEqual(readCart(store, A)?.truckId, "T02", "A's cart is still there after signing back in");
});

test("emptying one account's cart leaves the other's alone", () => {
  const store = fakeStore();
  writeCart(store, A, burgers);
  writeCart(store, B, tacos);
  writeCart(store, A, null);
  assert.equal(readCart(store, A), null);
  assert.deepEqual(readCart(store, B)?.items, { M301: 2 });
  writeCart(store, B, { ...tacos, items: {} });
  assert.equal(store.map.size, 0, "a cart with no dishes is removed");
});

test("a cart copied under another account's key is not accepted", () => {
  const store = fakeStore();
  writeCart(store, A, { ...burgers, requestId: "5e0a0751-0000-4000-8000-000000000001", requestBy: A });
  store.map.set(cartKey(B), store.map.get(cartKey(A))!);
  assert.equal(readCart(store, B), null, "the saved cart names A as its owner");
});

test("the old shared cart has no owner, so nobody inherits it", () => {
  const store = fakeStore();
  store.map.set(LEGACY_CART_KEY, JSON.stringify(burgers));
  assert.equal(readCart(store, A), null);
  dropLegacyCart(store);
  assert.equal(store.map.size, 0);
});

test("damaged or blocked storage reads as an empty cart", () => {
  const store = fakeStore();
  store.map.set(cartKey(A), "{not json");
  assert.equal(readCart(store, A), null);
  const blocked: KeyValueStore = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readCart(blocked, A), null);
  assert.doesNotThrow(() => writeCart(blocked, A, burgers));
  assert.doesNotThrow(() => dropLegacyCart(blocked));
});

// ---------------------------------------------------------------------------
// The Orders list
// ---------------------------------------------------------------------------

const order = (ref: string, status: string, service_date: string, slot_start: string, placed_at: string) => ({
  ref,
  status,
  service_date,
  slot_start,
  placed_at,
});

test("tonight's unfinished orders are active, earliest pickup first", () => {
  const { active, past } = splitOrders(
    [
      order("late", "placed", "2026-11-20", "21:00:00", "2026-11-20T15:00:00Z"),
      order("soon", "ready", "2026-11-20", "19:15:00", "2026-11-20T15:05:00Z"),
      order("mid", "preparing", "2026-11-20", "20:00:00", "2026-11-20T15:10:00Z"),
      order("done", "collected", "2026-11-20", "18:00:00", "2026-11-20T14:00:00Z"),
    ],
    "2026-11-20",
  );
  assert.deepEqual(active.map((o) => o.ref), ["soon", "mid", "late"]);
  assert.deepEqual(past.map((o) => o.ref), ["done"]);
});

test("finished, cancelled, rejected and earlier nights' orders are past, newest first", () => {
  const { active, past } = splitOrders(
    [
      order("cancelled", "cancelled", "2026-11-20", "21:00:00", "2026-11-20T16:00:00Z"),
      order("rejected", "rejected", "2026-11-20", "21:00:00", "2026-11-20T15:00:00Z"),
      order("stale", "placed", "2026-11-19", "22:00:00", "2026-11-19T18:00:00Z"),
      order("older", "collected", "2026-11-18", "19:00:00", "2026-11-18T15:00:00Z"),
    ],
    "2026-11-20",
  );
  assert.deepEqual(active, []);
  assert.deepEqual(past.map((o) => o.ref), ["cancelled", "rejected", "stale", "older"]);
});
