// Unit tests for matching a saved cart against a menu. Run with: pnpm test:unit
// Node runs this TypeScript file directly; no browser or database is involved.

import assert from "node:assert/strict";
import { test } from "node:test";
import { orderItems, resolveCart } from "../../lib/cart-lines.ts";
import type { MenuItem } from "../../lib/data.ts";

const dish = (id: string, price: number, sold_out = false): MenuItem => ({
  id,
  truck_id: "T02",
  name: id,
  category: "Burgers",
  price_kwd: price,
  description: null,
  sold_out,
  allergens: [],
});

const menu = [dish("M201", 1.95), dish("M202", 2.1), dish("M204", 1.25)];

test("a cart whose dishes are all on the menu can be ordered", () => {
  const cart = resolveCart({ M201: 1, M204: 1 }, menu);
  assert.deepEqual(cart.lines.map((l) => [l.item.id, l.quantity]), [["M201", 1], ["M204", 1]]);
  assert.deepEqual(cart.missingIds, []);
  assert.deepEqual(cart.soldOut, []);
  assert.equal(cart.orderable, true);
});

test("a saved dish that is no longer on the menu is reported, not dropped", () => {
  const cart = resolveCart({ M201: 1, M299: 2 }, menu);
  assert.deepEqual(cart.lines.map((l) => l.item.id), ["M201"]);
  assert.deepEqual(cart.missingIds, ["M299"]);
  assert.equal(cart.orderable, false);
});

test("a sold-out dish stays visible and blocks ordering", () => {
  const cart = resolveCart({ M201: 1, M204: 1 }, [dish("M201", 1.95), dish("M204", 1.25, true)]);
  assert.equal(cart.lines.length, 2);
  assert.deepEqual(cart.soldOut.map((l) => l.item.id), ["M204"]);
  assert.equal(cart.orderable, false);
});

test("a cart with nothing left on the menu cannot be ordered", () => {
  const cart = resolveCart({ M299: 1 }, menu);
  assert.deepEqual(cart.lines, []);
  assert.equal(cart.orderable, false);
});

test("an empty menu (for example after a failed read) never makes a cart orderable", () => {
  assert.equal(resolveCart({ M201: 1 }, []).orderable, false);
});

test("the order sent to the server is the whole saved cart, including unmatched dishes", () => {
  // If the screen ever let this through, the server would refuse the whole
  // order (item_not_on_menu) rather than place part of it.
  assert.deepEqual(orderItems({ M201: 1, M299: 2 }), [
    { item_id: "M201", quantity: 1 },
    { item_id: "M299", quantity: 2 },
  ]);
});
