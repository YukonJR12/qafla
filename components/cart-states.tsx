"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale";
import { primaryButton } from "./ui";

// The states cart and checkout share. Each one looks and reads differently,
// so a customer can tell "still loading" from "failed" from "nothing here".

/** Loading: grey bars the size of the content that is coming. */
export function CartSkeleton() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t.loading} className="space-y-3 pt-2">
      <div className="h-7 w-40 rounded-control bg-subtle" />
      <div className="h-16 rounded-control bg-subtle" />
      <div className="h-16 rounded-control bg-subtle" />
      <div className="h-12 rounded-control bg-subtle" />
    </div>
  );
}

/** A read failed. The saved cart is untouched; offer to try again. */
export function LoadError({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <section role="alert" className="rounded-panel bg-error-surface p-4 text-error">
      <h2 className="text-base leading-snug font-extrabold">{title}</h2>
      <p className="mt-1 text-sm">{body}</p>
      <button type="button" onClick={onRetry} className={`${primaryButton} mt-3`}>
        {t.retry}
      </button>
    </section>
  );
}

/** There is no cart at all. */
export function EmptyCart() {
  const { t } = useLocale();
  return (
    <div className="pt-10 text-center">
      <h2 className="text-2xl font-extrabold">{t.cartEmptyTitle}</h2>
      <p className="mt-2 text-muted">{t.cartEmptyBody}</p>
      <Link href="/explore" className={`${primaryButton} mt-6`}>
        {t.exploreTrucks}
      </Link>
    </div>
  );
}
