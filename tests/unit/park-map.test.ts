import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PARK_TRUCKS, parkTruck } from "../../lib/park-map.ts";
import { activeNav, afterSignIn, mayOpen } from "../../lib/routes.ts";

test("every seeded truck has exactly one fixed, distinct physical model", () => {
  const seed = readFileSync(new URL("../../seed/trucks.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map((line) => line.split(",")[0]);
  assert.deepEqual(PARK_TRUCKS.map((t) => t.id), seed);
  assert.equal(new Set(PARK_TRUCKS.map((t) => t.x + "," + t.z)).size, 6);
  assert.equal(new Set(PARK_TRUCKS.map((t) => t.roof)).size, 6);
  assert.equal(parkTruck("unknown"), undefined);
  assert.equal(parkTruck(null), undefined);
});
test("map deep links survive customer login and remain outside staff workspaces", () => {
  assert.equal(afterSignIn("customer", "/map?truck=T02"), "/map?truck=T02");
  assert.equal(activeNav("customer", "/map"), "map");
  assert.equal(mayOpen("vendor", "/map"), false);
  assert.equal(mayOpen("manager", "/map"), false);
});

