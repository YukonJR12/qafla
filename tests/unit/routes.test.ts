// Unit tests for the launch gate's decisions. Run with: pnpm test:unit
// No browser and no database: only "who is this, where are they, what now?".

import assert from "node:assert/strict";
import { test } from "node:test";
import { activeNav, afterSignIn, homeFor, mayOpen, navFor, route, safeNext, signInUrl, type Who } from "../../lib/routes.ts";

const customer: Who = { status: "signed-in", role: "customer", hasTruck: false };
const vendor: Who = { status: "signed-in", role: "vendor", hasTruck: true };
const manager: Who = { status: "signed-in", role: "manager", hasTruck: false };
const ticket = "/orders/8db31df6-fc06-477a-a615-cc257e1b97cd";

test("while the session is being restored, only the logo shows and nobody is sent anywhere", () => {
  for (const path of ["/", "/explore", "/vendor", "/sign-in", ticket]) {
    assert.deepEqual(route({ status: "restoring" }, path), { view: "splash", redirect: null });
  }
});

test("a signed-out visitor goes straight to sign-in, which remembers the page they asked for", () => {
  assert.deepEqual(route({ status: "signed-out" }, "/"), { view: "splash", redirect: "/sign-in" });
  assert.deepEqual(route({ status: "signed-out" }, ticket), {
    view: "splash",
    redirect: `/sign-in?next=${encodeURIComponent(ticket)}`,
  });
  assert.equal(
    route({ status: "signed-out" }, "/manager", "?slot=21:00&truck=T02").redirect,
    `/sign-in?next=${encodeURIComponent("/manager?slot=21:00&truck=T02")}`,
  );
  // The sign-in screen itself is shown as it is.
  assert.deepEqual(route({ status: "signed-out" }, "/sign-in", "?next=/cart"), { view: "page", redirect: null });
});

test("after tapping Sign out, the next person starts on a clean sign-in screen", () => {
  assert.equal(route({ status: "signed-out", onPurpose: true }, ticket).redirect, "/sign-in");
  assert.equal(route({ status: "signed-out", onPurpose: true }, "/vendor/capacity").redirect, "/sign-in");
});

test("a returning user goes straight to their own workspace", () => {
  assert.equal(route(customer, "/").redirect, "/explore");
  assert.equal(route(vendor, "/").redirect, "/vendor");
  assert.equal(route(manager, "/").redirect, "/manager");
  assert.equal(homeFor("customer"), "/explore");
});

test("after sign-in, a permitted deep link wins; anything else falls back to the workspace", () => {
  assert.equal(route(customer, "/sign-in", `?next=${encodeURIComponent(ticket)}`).redirect, ticket);
  assert.equal(route(customer, "/sign-in", "?next=/checkout").redirect, "/checkout");
  assert.equal(route(vendor, "/sign-in", "?next=/vendor/capacity").redirect, "/vendor/capacity");
  assert.equal(route(manager, "/sign-in", `?next=${encodeURIComponent("/manager?slot=21:00&truck=T02")}`).redirect, "/manager?slot=21:00&truck=T02");
  // A link that belongs to another role is dropped.
  assert.equal(route(vendor, "/sign-in", `?next=${encodeURIComponent(ticket)}`).redirect, "/vendor");
  assert.equal(route(customer, "/sign-in", "?next=/manager").redirect, "/explore");
  assert.equal(route(manager, "/sign-in", "?next=/vendor").redirect, "/manager");
  assert.equal(route(customer, "/sign-in").redirect, "/explore");
});

test("a return address can never leave the app", () => {
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "explore", "", null, "/", "/sign-in", "/sign-in?next=/x"]) {
    assert.equal(safeNext(bad), null, String(bad));
  }
  assert.equal(safeNext("/orders/abc"), "/orders/abc");
  assert.equal(afterSignIn("customer", "//evil.example/explore"), "/explore");
  assert.equal(signInUrl("//evil.example"), "/sign-in");
});

test("each role opens only its own screens", () => {
  for (const path of ["/explore", "/trucks/T02", "/cart", "/checkout", "/orders", ticket, "/account"]) {
    assert.equal(mayOpen("customer", path), true, path);
  }
  for (const path of ["/vendor", "/vendor/capacity", "/manager"]) assert.equal(mayOpen("customer", path), false, path);

  for (const path of ["/vendor", "/vendor/capacity", "/account"]) assert.equal(mayOpen("vendor", path), true, path);
  for (const path of ["/explore", "/checkout", "/orders", "/manager", "/vendors"]) assert.equal(mayOpen("vendor", path), false, path);

  for (const path of ["/manager", "/manager?slot=21:00&truck=T02", "/account"]) assert.equal(mayOpen("manager", path), true, path);
  for (const path of ["/explore", "/vendor", "/orders"]) assert.equal(mayOpen("manager", path), false, path);
});

test("a signed-in user who opens another role's screen is sent home", () => {
  assert.deepEqual(route(customer, "/manager"), { view: "splash", redirect: "/explore" });
  assert.deepEqual(route(vendor, "/explore"), { view: "splash", redirect: "/vendor" });
  assert.deepEqual(route(manager, "/vendor/capacity"), { view: "splash", redirect: "/manager" });
  assert.deepEqual(route(customer, ticket), { view: "page", redirect: null });
  assert.deepEqual(route(vendor, "/vendor/capacity"), { view: "page", redirect: null });
});

test("a vendor with no truck assigned gets its own screen everywhere, and is not redirected in a loop", () => {
  const unassigned: Who = { status: "signed-in", role: "vendor", hasTruck: false };
  for (const path of ["/", "/vendor", "/vendor/capacity", "/account", "/explore", "/sign-in"]) {
    assert.deepEqual(route(unassigned, path), { view: "unassigned", redirect: null }, path);
  }
});

test("a profile that could not be read shows a problem, never a guessed workspace", () => {
  assert.deepEqual(route({ status: "failed" }, "/explore"), { view: "failed", redirect: null });
  assert.deepEqual(route({ status: "failed" }, "/"), { view: "failed", redirect: null });
});

test("the navigation offers each role its own three destinations", () => {
  assert.deepEqual(navFor("customer").map((item) => item.key), ["explore", "orders", "account"]);
  assert.deepEqual(navFor("vendor").map((item) => item.key), ["kitchen", "capacity", "account"]);
  assert.deepEqual(navFor("manager").map((item) => item.key), ["overview", "slot", "account"]);
  // Every destination is one that role may open.
  for (const role of ["customer", "vendor", "manager"] as const) {
    for (const item of navFor(role)) assert.equal(mayOpen(role, item.href), true, `${role} ${item.href}`);
  }
});

test("the navigation marks where the user is", () => {
  assert.equal(activeNav("customer", "/explore"), "explore");
  assert.equal(activeNav("customer", "/trucks/T02"), "explore");
  assert.equal(activeNav("customer", "/orders"), "orders");
  assert.equal(activeNav("customer", ticket), "orders");
  assert.equal(activeNav("customer", "/account"), "account");
  assert.equal(activeNav("vendor", "/vendor"), "kitchen");
  assert.equal(activeNav("vendor", "/vendor/capacity"), "capacity");
  assert.equal(activeNav("manager", "/manager"), "overview");
  assert.equal(activeNav("manager", "/manager", "slot=21:00"), "overview");
  assert.equal(activeNav("manager", "/manager", "slot=21:00&truck=T02"), "slot");
  assert.equal(activeNav("manager", "/manager", "view=slot"), "slot");
});
