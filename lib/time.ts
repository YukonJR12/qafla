import type { Locale } from "./i18n";

// The park runs on Kuwait time, whatever the phone's own time zone is.
// The database makes the final decision (place_order); these helpers only
// decide what the screen offers.

/** Orders must be placed at least this long before the slot starts. */
export const LEAD_SECONDS = 15 * 60;

const kuwaitParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuwait",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Today's date in Kuwait and how many seconds into that day it is. */
export function kuwaitNow(now: Date = new Date()): { date: string; seconds: number } {
  const part = Object.fromEntries(kuwaitParts.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    seconds: Number(part.hour) * 3600 + Number(part.minute) * 60 + Number(part.second),
  };
}

/** "19:15:00" -> 69300 */
export function slotSeconds(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return h * 3600 + m * 60;
}

/** "19:15:00" -> "7:15 PM" in English, "7:15 م" in Arabic. Western digits in both. */
export function formatSlot(slot: string, locale: Locale): string {
  const [h, m] = slot.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = String(m).padStart(2, "0");
  const suffix = h < 12 ? (locale === "ar" ? "ص" : "AM") : locale === "ar" ? "م" : "PM";
  return `${hour12}:${minutes} ${suffix}`;
}

const kuwaitClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuwait", hourCycle: "h23", hour: "2-digit", minute: "2-digit" });

/** A saved moment (e.g. when an order was collected) as Kuwait time: "7:02 PM" or "7:02 م". */
export function formatKuwaitTime(moment: string | Date, locale: Locale): string {
  return formatSlot(kuwaitClock.format(typeof moment === "string" ? new Date(moment) : moment), locale);
}

/** A service date ("2026-11-20") as a short day: "20 Nov" or "20 نوفمبر". Western digits in both. */
export function formatDay(date: string, locale: Locale, style: "short" | "long" = "short"): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: style,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
