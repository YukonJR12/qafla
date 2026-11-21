// Unit tests for the image pack's mapping: every truck has a logo, every
// dish has its photo, and the photos shown for a truck on Explore are that
// truck's own dishes. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { dishPhoto, truckDishPhotos, truckLogo, truckPhoto } from "../../lib/images.ts";

const TRUCKS = ["T01", "T02", "T03", "T04", "T05", "T06"];
const onDisk = (url: string) => existsSync(`public${url}`);

test("all six trucks have a logo file, including Dune Burgers", () => {
  for (const id of TRUCKS) {
    const logo = truckLogo(id);
    assert.equal(logo, `/trucks/logos/${id}.webp`);
    assert.ok(onDisk(logo!), logo!);
  }
  assert.equal(truckLogo("T99"), null);
});

test("all 30 dishes have a photo file named by their own ID", () => {
  for (let truck = 1; truck <= 6; truck += 1) {
    for (let dish = 1; dish <= 5; dish += 1) {
      const id = `M${truck}0${dish}`;
      assert.equal(dishPhoto(id), `/dishes/${id}.webp`);
      assert.ok(onDisk(dishPhoto(id)!), id);
    }
  }
  assert.equal(dishPhoto("M999"), null);
});

test("Explore shows three of a truck's own dishes, never another truck's", () => {
  for (const id of TRUCKS) {
    const n = Number(id.slice(1));
    assert.deepEqual(truckDishPhotos(id), [`/dishes/M${n}01.webp`, `/dishes/M${n}02.webp`, `/dishes/M${n}03.webp`]);
  }
  assert.deepEqual(truckDishPhotos("T99"), []);
});

test("the Dune Burgers poster uses its Classic smash photo", () => {
  assert.equal(truckPhoto("T02"), "/dishes/M201.webp");
  assert.ok(onDisk("/dishes/M201.webp"));
});
