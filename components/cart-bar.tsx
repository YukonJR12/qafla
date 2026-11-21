"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { useCartLines } from "@/lib/use-cart-lines";
import { ArrowForward, BagIcon, Isolate, Money, primaryButton, primaryButtonSplit, secondaryButton } from "./ui";

/**
 * The cart, kept within thumb's reach on Explore and on a menu: an opaque
 * bar pinned above the bottom navigation with the number of dishes and the
 * total. It appears when the cart has something in it.
 *
 * - `onlyTruck`: on a truck's menu, show it only for that truck's cart.
 * - `showTruck`: on Explore, name the truck the cart belongs to.
 * - `total`: a total the page has already worked out from the menu it shows.
 *
 * The count badge gives a short bump each time the quantity changes, so
 * adding a dish is confirmed where the eye already is.
 */
export function CartBar({
  onlyTruck,
  showTruck = false,
  total,
  className = "",
}: {
  onlyTruck?: string;
  showTruck?: boolean;
  total?: number;
  className?: string;
}) {
  const { locale, t } = useLocale();
  const { cart, count } = useCart();
  const lines = useCartLines();

  if (!cart || count === 0 || (onlyTruck && cart.truckId !== onlyTruck)) return null;
  const amount = total ?? (lines.status === "ready" ? lines.total : null);

  return (
    <div
      className={`reveal-up fixed inset-x-0 bottom-(--nav-h) z-30 border-t border-divider bg-snowy-white md:pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <div className="mx-auto max-w-xl px-4 py-3 md:px-6">
        <Link href="/cart" className={primaryButtonSplit}>
          <span className="flex min-w-0 items-center gap-2.5">
            <BagIcon className="size-5" />
            <span className="min-w-0 text-start leading-tight">
              {/* Re-keyed by the count, so it bumps each time a dish is added or removed. */}
              <span key={count} className="bump inline-block">
                {t.viewOrder(count)}
              </span>
              {showTruck && (
                <span className="block truncate text-sm font-semibold">
                  {truckName({ id: cart.truckId, name: cart.truckName }, locale)}
                </span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {amount !== null && <Money amount={amount} locale={locale} />}
            <ArrowForward className="size-5" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * From 1024 px the cart sits beside the menu as a 320 px summary
 * (DESIGN.md, Layout): what is in it, the total, and the way to checkout.
 * It stays in view while the menu scrolls.
 */
export function CartSummary() {
  const { locale, t } = useLocale();
  const { cart, count } = useCart();
  const { status, lines, total, orderable } = useCartLines();

  return (
    <aside aria-labelledby="cart-summary-title" className="sticky top-4 rounded-panel border border-ink p-4">
      <h2 id="cart-summary-title" className="text-lg font-extrabold">
        {t.cartSummary}
      </h2>
      {!cart || count === 0 ? (
        <p className="mt-2 text-muted">{t.cartSummaryEmpty}</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">{truckName({ id: cart.truckId, name: cart.truckName }, locale)}</p>
          {status === "ready" && (
            <ul className="mt-3 space-y-1.5 border-t border-divider pt-3">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <Isolate className="font-bold">{quantity} ×</Isolate> {itemName(item, locale)}
                  </span>
                  <Money amount={Number(item.price_kwd) * quantity} locale={locale} className="font-semibold" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-dashed border-outline pt-3">
            <p>
              <span className="font-bold">{t.total}</span>{" "}
              <span key={count} className="bump inline-block text-sm text-muted">
                · {t.itemCount(count)}
              </span>
            </p>
            {status === "ready" && <Money amount={total} locale={locale} className="text-2xl font-extrabold" />}
          </div>
          <div className="mt-4 space-y-2">
            {orderable && (
              <Link href="/checkout" className={primaryButton}>
                {t.choosePickup}
                <ArrowForward className="size-5" />
              </Link>
            )}
            <Link href="/cart" className={orderable ? secondaryButton : primaryButton}>
              {t.viewCart}
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
