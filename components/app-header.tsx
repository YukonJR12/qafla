"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale";
import { LanguageSwitch } from "./language-switch";
import { ArrowBack } from "./ui";

/**
 * The compact header for cart, checkout, sign-in and the ticket: a back
 * link, the park name as text, the page title and the language switch.
 */
export function AppHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  const { t } = useLocale();
  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-snowy-white">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2 md:px-6">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-subtle text-ink transition-colors duration-[120ms] ease-out hover:bg-divider"
        >
          <ArrowBack className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{t.appName}</p>
          <h1 className="text-lg leading-tight font-extrabold text-balance">{title}</h1>
        </div>
        <LanguageSwitch />
      </div>
    </header>
  );
}
