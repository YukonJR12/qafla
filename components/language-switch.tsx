"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { GlobeIcon } from "./ui";

/**
 * Switches between English and Arabic. The choice is stored in a cookie and
 * the current page is re-rendered in place, so the route, the cart and the
 * chosen pickup time all stay as they were.
 */
export function LanguageSwitch({ onPoster = false }: { onPoster?: boolean }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      lang={other}
      aria-label={t.otherLanguageLabel}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-[120ms] ease-out ${
        other === "ar" ? "font-arabic" : "font-sans"
      } ${
        onPoster
          ? "border-ink bg-snowy-white text-ink hover:bg-subtle"
          : "border-divider bg-subtle text-ink hover:border-outline"
      }`}
    >
      <GlobeIcon className="size-4" />
      {t.otherLanguage}
    </button>
  );
}
