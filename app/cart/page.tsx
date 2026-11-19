"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ArrowForward, Money, primaryButton, secondaryButton } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { useCartLines } from "@/lib/use-cart-lines";

// The cart: one truck's dishes, quantities and a preview of the total.
export default function CartPage() {
  const { locale, t } = useLocale();
  const { cart, count, setQuantity } = useCart();
  const { lines, total, loading } = useCartLines();

  const truck = cart ? { id: cart.truckId, name: cart.truckName } : null;

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.cart} backHref={truck ? `/trucks/${truck.id}` : "/explore"} backLabel={t.back} />

      <main className="mx-auto max-w-xl px-4 pt-4 pb-10 md:px-6">
        {loading ? (
          // Reserve the space the cart will take, so nothing jumps when it arrives.
          <p className="min-h-64 text-muted" aria-live="polite">
            {t.loading}
          </p>
        ) : !truck || lines.length === 0 ? (
          <div className="pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.cartEmptyTitle}</h2>
            <p className="mt-2 text-muted">{t.cartEmptyBody}</p>
            <Link href="/explore" className={`${primaryButton} mt-6`}>
              {t.exploreTrucks}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">{t.orderingFrom}</p>
            <h2 className="text-2xl leading-tight font-extrabold">{truckName(truck, locale)}</h2>

            <ul className="mt-3 divide-y divide-divider border-y border-divider">
              {lines.map(({ item, quantity }) => {
                const name = itemName(item, locale);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{name}</h3>
                      <p className="text-sm text-muted">
                        <Money amount={item.price_kwd} locale={locale} />
                      </p>
                    </div>
                    <QuantityStepper
                      name={name}
                      quantity={quantity}
                      onChange={(q) => setQuantity(truck, item.id, q)}
                    />
                  </li>
                );
              })}
            </ul>

            <div className="flex items-baseline justify-between gap-3 py-4">
              <p>
                <span className="text-lg font-bold">{t.total}</span>{" "}
                <span className="text-sm text-muted">· {t.itemCount(count)}</span>
              </p>
              <Money amount={total} locale={locale} className="text-2xl font-extrabold" />
            </div>

            <div className="space-y-2">
              <Link href="/checkout" className={primaryButton}>
                {t.choosePickup}
                <ArrowForward className="size-5" />
              </Link>
              <Link href={`/trucks/${truck.id}`} className={secondaryButton}>
                {t.addMore}
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
