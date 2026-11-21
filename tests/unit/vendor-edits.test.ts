// Unit tests for what a vendor may type, and for the two closed states.
// Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { truckBlurb, truckCuisine, truckName } from "../../lib/i18n.ts";
import { activeNav } from "../../lib/routes.ts";
import { dictionary } from "../../lib/i18n.ts";
import { BLURB_MAX, canSwitch, checkDetails, closedBy, CUISINE_MAX, NAME_MAX, operating, parsePrice, priceText } from "../../lib/vendor-edits.ts";

test("a typed price becomes text with exactly three decimals", () => {
  for (const [typed, price] of [
    ["1.950", "1.950"],
    ["1.95", "1.950"],
    ["2", "2.000"],
    ["2.", "2.000"],
    [".5", "0.500"],
    ["0.001", "0.001"],
    ["  3.2 ", "3.200"],
    ["007.5", "7.500"],
    ["999.999", "999.999"],
  ]) {
    assert.deepEqual(parsePrice(typed), { ok: true, price }, typed);
  }
});

test("Arabic digits and the Arabic decimal mark mean the same price", () => {
  assert.deepEqual(parsePrice("١٫٩٥٠"), { ok: true, price: "1.950" });
  assert.deepEqual(parsePrice("۲.۵"), { ok: true, price: "2.500" });
  assert.deepEqual(parsePrice("1,25"), { ok: true, price: "1.250" });
});

test("a price that cannot be saved is refused with the reason", () => {
  for (const [typed, problem] of [
    ["", "price_missing"],
    ["   ", "price_missing"],
    ["1.9505", "price_decimals"],
    ["0", "price_zero"],
    ["0.000", "price_zero"],
    [".", "price_not_a_number"],
    ["-1.5", "price_not_a_number"],
    ["+2", "price_not_a_number"],
    ["1e3", "price_not_a_number"],
    ["1.2.3", "price_not_a_number"],
    ["two", "price_not_a_number"],
    ["1 950", "price_not_a_number"],
    ["0x10", "price_not_a_number"],
    ["1000", "price_too_high"],
    ["12345.000", "price_too_high"],
  ]) {
    assert.deepEqual(parsePrice(typed), { ok: false, problem }, JSON.stringify(typed));
  }
});

test("a saved price reads back with three decimals", () => {
  assert.equal(priceText(1.95), "1.950");
  assert.equal(priceText("2"), "2.000");
  assert.equal(priceText("0.7"), "0.700");
});

test("truck details are tidied to one line and checked for length", () => {
  const tidy = checkDetails({ name: "  Dune   Burgers \n", cuisine: " Burgers ", blurb: "  " });
  assert.deepEqual(tidy.details, { name: "Dune Burgers", cuisine: "Burgers", blurb: "" });
  assert.deepEqual(tidy.problems, {}); // an empty description is allowed

  assert.deepEqual(checkDetails({ name: " ", cuisine: "", blurb: "" }).problems, { name: "name_missing", cuisine: "cuisine_missing" });
  assert.deepEqual(checkDetails({ name: "x".repeat(NAME_MAX + 1), cuisine: "x".repeat(CUISINE_MAX + 1), blurb: "x".repeat(BLURB_MAX + 1) }).problems, {
    name: "name_long",
    cuisine: "cuisine_long",
    blurb: "blurb_long",
  });
  assert.deepEqual(checkDetails({ name: "x".repeat(NAME_MAX), cuisine: "x".repeat(CUISINE_MAX), blurb: "x".repeat(BLURB_MAX) }).problems, {});
  // Arabic counts by character, the same way the database does.
  assert.deepEqual(checkDetails({ name: "ديون برجر", cuisine: "برجر", blurb: "سماش برجر يتحضّر عند الطلب." }).problems, {});
});

test("the vendor's switch and the park manager's closure are two different states", () => {
  assert.equal(operating({ isOpen: true, closedByPark: false }), "open");
  assert.equal(operating({ isOpen: false, closedByPark: false }), "paused");
  // The manager's closure wins, whatever the vendor's switch says.
  assert.equal(operating({ isOpen: true, closedByPark: true }), "park");
  assert.equal(operating({ isOpen: false, closedByPark: true }), "park");
  assert.equal(canSwitch("open"), true);
  assert.equal(canSwitch("paused"), true);
  assert.equal(canSwitch("park"), false);
});

test("the Arabic label is used only while a truck still has its seeded text", () => {
  const seeded = { id: "T02", name: "Dune Burgers", cuisine: "Burgers", blurb: "Smash burgers cooked to order." };
  assert.equal(truckName(seeded, "en"), "Dune Burgers");
  assert.equal(truckName(seeded, "ar"), "ديون برجر");
  assert.equal(truckCuisine(seeded, "ar"), "برجر");
  assert.equal(truckBlurb(seeded, "ar"), "سماش برجر يتحضّر عند الطلب.");
  // Once the vendor writes their own, that is what both languages show.
  const edited = { id: "T02", name: "Dune Burgers & Fries", cuisine: "Burgers", blurb: "" };
  assert.equal(truckName(edited, "ar"), "Dune Burgers & Fries");
  assert.equal(truckCuisine(edited, "ar"), "برجر"); // not edited, so still translated
  assert.equal(truckBlurb(edited, "ar"), "");
});

test("Truck details sits under the Kitchen tab", () => {
  assert.equal(activeNav("vendor", "/vendor/truck"), "kitchen");
  assert.equal(activeNav("vendor", "/vendor"), "kitchen");
  assert.equal(activeNav("vendor", "/vendor/menu/M201"), "menu");
});

test("customers are told which closure it is, and the park's closure comes first", () => {
  assert.equal(closedBy({ isOpen: true, closedByPark: false }), null);
  assert.equal(closedBy({ isOpen: false, closedByPark: false }), "vendor");
  assert.equal(closedBy({ isOpen: true, closedByPark: true }), "park");
  // Paused by the vendor AND closed by the park: it is closed for tonight.
  assert.equal(closedBy({ isOpen: false, closedByPark: true }), "park");
  assert.equal(dictionary.en.pausedNow, "Not taking orders right now");
  assert.equal(dictionary.ar.pausedNow, "ما نستقبل طلبات حاليًا");
  // The two read differently in both languages, on the label and in the checkout message.
  for (const locale of ["en", "ar"] as const) {
    const t = dictionary[locale];
    assert.notEqual(t.pausedNow, t.closedTonight);
    assert.notEqual(t.pausedMenuNote("Dune Burgers"), t.closedMenuNote);
    assert.notEqual(t.truckPausedTitle("Dune Burgers"), t.truckClosedTitle("Dune Burgers"));
    assert.notEqual(t.truckPausedBody, t.truckClosedBody);
  }
});
