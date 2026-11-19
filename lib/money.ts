import type { Locale } from "./i18n";

/**
 * The one place a Kuwaiti dinar amount becomes text.
 *
 * Always three decimals and Western digits: "3.200 KWD" in English and
 * "3.200 د.ك." in Arabic (DESIGN.md). The database sends prices as numbers
 * or strings ("1.950"); both are accepted.
 *
 * Dinars are turned into whole fils first (1 KWD = 1000 fils), because
 * 1.95 + 1.25 in floating point is not exactly 3.2.
 */
export function toFils(amount: number | string): number {
  return Math.round(Number(amount) * 1000);
}

export function formatKwd(amount: number | string, locale: Locale): string {
  const text = (toFils(amount) / 1000).toFixed(3);
  return locale === "ar" ? `${text} د.ك.` : `${text} KWD`;
}

/** Adds up price x quantity lines without floating-point drift. */
export function sumKwd(lines: { price: number | string; quantity: number }[]): number {
  return lines.reduce((fils, line) => fils + toFils(line.price) * line.quantity, 0) / 1000;
}
