// The supplied image pack, matched to the seed data by ID.
//
// The originals are large PNGs. Each one was resized and saved as WebP:
// truck logos at 384 px with their transparent background, dish photos at
// 480 px. Dune Burgers' logo came on a cream background, which was cut away
// to match the other five. A truck or dish without a picture simply has no entry here, and
// the screen shows its name instead (DESIGN.md: "When a photo is missing, a
// bold truck name or a simple menu row completes the layout").

/** Trucks with a logo in the pack. */
const TRUCK_LOGOS = new Set(["T01", "T02", "T03", "T04", "T05", "T06"]);

/** Trucks with a food photo for the Explore poster (Dune's Classic smash). */
const TRUCK_PHOTOS: Record<string, string> = { T02: "/dishes/M201.webp" };

/** Dishes with a photo in the pack. */
const DISH_PHOTOS = new Set([
  "M101", "M102", "M103", "M104", "M105",
  "M201", "M202", "M203", "M204", "M205",
  "M301", "M302", "M303", "M304", "M305",
  "M401", "M402", "M403", "M404", "M405",
  "M501", "M502", "M503", "M504", "M505",
  "M601", "M602", "M603", "M604", "M605",
]);

export function truckLogo(truckId: string): string | null {
  return TRUCK_LOGOS.has(truckId) ? `/trucks/logos/${truckId}.webp` : null;
}

export function truckPhoto(truckId: string): string | null {
  return TRUCK_PHOTOS[truckId] ?? null;
}

export function dishPhoto(itemId: string): string | null {
  return DISH_PHOTOS.has(itemId) ? `/dishes/${itemId}.webp` : null;
}
