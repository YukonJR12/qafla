"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatKwd } from "@/lib/money";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { useCartLines } from "@/lib/use-cart-lines";
import { BagIcon } from "./ui";

/**
 * Reminds the customer that a cart is waiting while they browse elsewhere,
 * for example after their truck closed. Hidden on that cart's own truck.
 */
export function SavedCartNotice({ hideForTruck, className = "" }: { hideForTruck?: string; className?: string }) {
  const { cart, count } = useCart();
  const { lines, total, loading } = useCartLines();
  const { locale, t } = useLocale();

  if (!cart || loading || lines.length === 0 || cart.truckId === hideForTruck) return null;

  const name = truckName({ id: cart.truckId, name: cart.truckName }, locale);
  return (
    <p
      className={`flex items-center gap-3 rounded-control border border-divider bg-subtle py-2 ps-3 pe-2 text-sm font-semibold ${className}`}
    >
      <BagIcon className="size-5" />
      <span className="min-w-0 flex-1">{t.savedCart(name, count, formatKwd(total, locale))}</span>
      <Link
        href="/cart"
        className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-ink px-3.5 font-bold text-snowy-white transition-colors duration-[120ms] ease-out hover:bg-ink-pressed"
      >
        {t.view}
      </Link>
    </p>
  );
}
