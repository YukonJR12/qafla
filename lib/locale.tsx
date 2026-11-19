"use client";

import { createContext, useContext } from "react";
import { dictionary, type Locale } from "./i18n";

const LocaleContext = createContext<Locale>("en");

/** Hands the language chosen on the server to every client component. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The current language and its words: `const { locale, t } = useLocale()`. */
export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, t: dictionary[locale] };
}
