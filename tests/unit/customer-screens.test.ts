// Unit tests for the small rules behind the customer screens: Explore's
// search, the Account card's initials, the ticket's money line and the
// grouping of past orders. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryName, dictionary } from "../../lib/i18n.ts";
import { initials } from "../../lib/initials.ts";
import { groupByDate } from "../../lib/orders.ts";
import { moneyLine } from "../../lib/payments.ts";
import { fold, matchTrucks } from "../../lib/truck-search.ts";

const trucks = [
  { id: "T01", name: "Karak Corner", cuisine: "Tea and snacks", blurb: "Karak, toasties and quick bites." },
  { id: "T02", name: "Dune Burgers", cuisine: "Burgers", blurb: "Smash burgers cooked to order." },
  { id: "T04", name: "Noodle Wagon", cuisine: "Noodles", blurb: "Wok noodles, fresh off the flame." },
];
const dishes = [
  { id: "M101", truck_id: "T01", name: "Karak tea" },
  { id: "M201", truck_id: "T02", name: "Classic smash" },
  { id: "M402", truck_id: "T04", name: "Beef udon" },
];
const ids = (found: { truck: { id: string } }[]) => found.map((r) => r.truck.id);

test("an empty search shows every truck, in order", () => {
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "")), ["T01", "T02", "T04"]);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "   ")), ["T01", "T02", "T04"]);
});

test("search finds a truck by its name, cuisine or description, whatever the letter case", () => {
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "dune")), ["T02"]);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "NOODLES")), ["T04"]);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "toasties")), ["T01"]);
});

test("search finds a truck by a dish on its menu, and says which dish", () => {
  const found = matchTrucks(trucks, dishes, "udon");
  assert.deepEqual(ids(found), ["T04"]);
  assert.deepEqual(found[0].dishes.map((d) => d.name), ["Beef udon"]);
  // A truck that matches by its own name does not list dishes as the reason.
  assert.deepEqual(matchTrucks(trucks, dishes, "karak")[0].dishes, []);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "pizza")), []);
});

test("search also looks in the words shown in the current language", () => {
  const shown = (truck: { id: string }) => (truck.id === "T02" ? ["ديون برجر", "برجر"] : []);
  const dishShown = (dish: { id: string; name: string }) => (dish.id === "M101" ? "شاي كرك" : dish.name);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "برجر", shown, dishShown)), ["T02"]);
  assert.deepEqual(ids(matchTrucks(trucks, dishes, "كرك", shown, dishShown)), ["T01"]);
});

test("search ignores accents, Arabic vowel marks and alef variants", () => {
  assert.equal(fold("Café  Olé"), "cafe ole");
  assert.equal(fold("كَرَك"), fold("كرك"));
  assert.equal(fold("أكل"), fold("اكل"));
});

test("initials come from the name, or from the email when there is no name", () => {
  assert.equal(initials("Faisal Alrefae", "x@example.com"), "FA");
  assert.equal(initials("Test Customer", "x@example.com"), "TC");
  assert.equal(initials("Dana", "x@example.com"), "DA");
  assert.equal(initials("  Mary  Ann  Lee ", "x@example.com"), "ML");
  assert.equal(initials(null, "qafla.customer@example.com"), "QC");
  assert.equal(initials("", "sam@example.com"), "SA");
  assert.equal(initials("نورة العلي", "x@example.com"), "نا");
  assert.equal(initials(null, "@example.com"), "?");
});

test("the ticket's money line follows the order's real payment state", () => {
  const order = (status: string, payment_method: string, payment_status: string) => ({ status, payment_method, payment_status });
  assert.equal(moneyLine(order("placed", "pay_at_pickup", "unpaid")), "due_at_pickup");
  assert.equal(moneyLine(order("ready", "pay_at_pickup", "unpaid")), "due_at_pickup");
  assert.equal(moneyLine(order("placed", "online", "unpaid")), "online_unpaid");
  assert.equal(moneyLine(order("accepted", "online", "paid")), "paid");
  // Cancelled or rejected before any money moved: nothing to pay, and no reminder.
  assert.equal(moneyLine(order("cancelled", "pay_at_pickup", "unpaid")), "nothing_to_pay");
  assert.equal(moneyLine(order("cancelled", "online", "unpaid")), "nothing_to_pay");
  assert.equal(moneyLine(order("rejected", "pay_at_pickup", "unpaid")), "nothing_to_pay");
  // Paid, then cancelled or rejected: the database marks it refund due.
  assert.equal(moneyLine(order("rejected", "online", "refund_due")), "refund_due");
  assert.equal(moneyLine(order("cancelled", "online", "refund_due")), "refund_due");
  for (const locale of ["en", "ar"] as const) {
    const t = dictionary[locale].moneyLine;
    for (const key of ["nothing_to_pay", "refund_due", "paid", "due_at_pickup", "online_unpaid"]) assert.ok(t[key].title && t[key].note, `${locale} ${key}`);
    assert.doesNotMatch(t.nothing_to_pay.note, /not paid yet|غير مدفوع/i);
  }
});

test("past orders are grouped under their date, keeping newest first", () => {
  const list = [
    { id: "c", service_date: "2026-11-21" },
    { id: "b", service_date: "2026-11-21" },
    { id: "a", service_date: "2026-11-20" },
  ];
  assert.deepEqual(groupByDate(list).map((g) => [g.date, g.orders.map((o) => o.id)]), [
    ["2026-11-21", ["c", "b"]],
    ["2026-11-20", ["a"]],
  ]);
  assert.deepEqual(groupByDate([]), []);
});

test("the five stage labels are short in both languages, and menu categories have Arabic names", () => {
  for (const locale of ["en", "ar"] as const) {
    const labels = dictionary[locale].stageLabel;
    assert.deepEqual(Object.keys(labels), ["placed", "accepted", "preparing", "ready", "collected"]);
    for (const label of Object.values(labels)) assert.ok(Array.from(label).length <= 11, label);
  }
  assert.equal(categoryName("Drinks", "en"), "Drinks");
  assert.equal(categoryName("Drinks", "ar"), "مشروبات");
  assert.equal(categoryName("Chef's specials", "ar"), "Chef's specials"); // a renamed category is shown as saved
});
