import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./i18n";

/** The visitor's language, remembered in a cookie. English by default. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "ar" ? "ar" : "en";
}
