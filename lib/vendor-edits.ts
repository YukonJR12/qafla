// What a vendor may type for their truck and their dishes, checked before
// anything is sent. Pure logic, so it can be unit tested
// (tests/unit/vendor-edits.test.ts).
//
// These checks are a courtesy to the vendor: they explain a mistake next to
// the field. The database has the same limits as check constraints
// (supabase/migrations/…_vendor_controls.sql), and row-level security
// decides whose truck it is, so skipping this file gains nothing.

export const NAME_MAX = 40;
export const CUISINE_MAX = 30;
export const BLURB_MAX = 120;
/** A menu price is more than zero and less than this many dinars. */
export const PRICE_LIMIT = 1000;

/** One line of text: outer spaces removed, inner runs of whitespace made one space. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type TruckDetails = { name: string; cuisine: string; blurb: string };
export type DetailProblem = "name_missing" | "name_long" | "cuisine_missing" | "cuisine_long" | "blurb_long";

/**
 * Tidies the three truck fields and names the first thing wrong with each.
 * `problems` is empty when the details can be saved.
 */
export function checkDetails(draft: TruckDetails): { details: TruckDetails; problems: Partial<Record<keyof TruckDetails, DetailProblem>> } {
  const details = { name: oneLine(draft.name), cuisine: oneLine(draft.cuisine), blurb: oneLine(draft.blurb) };
  const problems: Partial<Record<keyof TruckDetails, DetailProblem>> = {};
  // Array.from counts characters the way Postgres does, so an emoji is one.
  const length = (text: string) => Array.from(text).length;
  if (details.name === "") problems.name = "name_missing";
  else if (length(details.name) > NAME_MAX) problems.name = "name_long";
  if (details.cuisine === "") problems.cuisine = "cuisine_missing";
  else if (length(details.cuisine) > CUISINE_MAX) problems.cuisine = "cuisine_long";
  if (length(details.blurb) > BLURB_MAX) problems.blurb = "blurb_long";
  return { details, problems };
}

export type PriceProblem = "price_missing" | "price_not_a_number" | "price_decimals" | "price_zero" | "price_too_high";

// Arabic-Indic (٠-٩) and Persian (۰-۹) digits, and the Arabic decimal mark,
// are what an Arabic keyboard types. They mean the same numbers.
const DIGITS: Record<string, string> = Object.fromEntries(
  [..."٠١٢٣٤٥٦٧٨٩"].map((d, i) => [d, String(i)]).concat([..."۰۱۲۳۴۵۶۷۸۹"].map((d, i) => [d, String(i)])),
);

/**
 * Reads a typed price in Kuwaiti dinars.
 *
 * Returns it as text with exactly three decimals ("1.950"), which is how
 * the database column stores it. Text, not a JavaScript number: 0.1 + 0.2
 * is not 0.3 in floating point, and money must not drift.
 *
 * Accepted: "2", "2.1", "2.10", "2.100", ".5", "٢٫٥". Refused: more than
 * three decimals (it would be rounded, and the vendor should decide how),
 * zero, a negative sign, anything that is not a plain number, 1000 or more.
 */
export function parsePrice(text: string): { ok: true; price: string } | { ok: false; problem: PriceProblem } {
  const typed = text
    .trim()
    .replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d])
    .replace(/[٫,]/g, ".");
  if (typed === "") return { ok: false, problem: "price_missing" };
  const match = /^(\d*)(?:\.(\d*))?$/.exec(typed);
  if (!match || (match[1] === "" && !match[2])) return { ok: false, problem: "price_not_a_number" };
  const whole = match[1].replace(/^0+(?=\d)/, "") || "0";
  const decimals = match[2] ?? "";
  if (decimals.length > 3) return { ok: false, problem: "price_decimals" };
  if (whole.length > String(PRICE_LIMIT - 1).length) return { ok: false, problem: "price_too_high" };
  const price = `${whole}.${decimals.padEnd(3, "0")}`;
  if (price === "0.000") return { ok: false, problem: "price_zero" };
  return { ok: true, price };
}

/** The same price as the database prints it: "1.95" and 1.95 both become "1.950". */
export function priceText(price: number | string): string {
  return Number(price).toFixed(3);
}

// ---------------------------------------------------------------------------
// Is the truck taking orders?
// ---------------------------------------------------------------------------

/**
 * - open:   customers can order.
 * - paused: the VENDOR switched the truck off. It stays off until the vendor
 *           switches it on again.
 * - park:   the PARK MANAGER closed the truck for tonight. This wins over the
 *           vendor's switch and lasts for tonight's service date.
 */
export type Operating = "open" | "paused" | "park";

export function operating(truck: { isOpen: boolean; closedByPark: boolean }): Operating {
  return truck.closedByPark ? "park" : truck.isOpen ? "open" : "paused";
}

/**
 * Why a customer cannot order from a truck right now, or null when they can.
 * The park manager's closure for tonight comes first: a truck that is both
 * paused by its vendor and closed by the park reads as closed for tonight.
 */
export type ClosedBy = "park" | "vendor" | null;

export function closedBy(truck: { isOpen: boolean; closedByPark: boolean }): ClosedBy {
  return truck.closedByPark ? "park" : truck.isOpen ? null : "vendor";
}

/** The vendor's switch can be used unless the park manager has closed the truck for tonight. */
export function canSwitch(state: Operating): boolean {
  return state !== "park";
}
