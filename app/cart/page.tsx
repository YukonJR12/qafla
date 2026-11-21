"use client";

import Image from "next/image";
import { dishPhoto, truckLogo } from "@/lib/images";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { CartSkeleton, EmptyCart, LoadError } from "@/components/cart-states";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ArrowForward, Money, primaryButton } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { useCartLines } from "@/lib/use-cart-lines";

// The cart: one truck's dishes, quantities and a preview of the total.
export default function CartPage() {
  const { locale, t } = useLocale();
  const { cart, count, setQuantity } = useCart();
  const { status, lines, missingIds, soldOut, orderable, total, retry } = useCartLines();

  const truck = cart ? { id: cart.truckId, name: cart.truckName } : null;

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.cart} backHref={truck ? `/trucks/${truck.id}` : "/explore"} backLabel={t.back} />

      <main className="mx-auto max-w-xl px-4 pt-4 pb-44 md:px-6">
        {status === "loading" && <CartSkeleton />}

        {status === "empty" && <EmptyCart />}

        {/* The menu could not be read. The cart itself is still saved. */}
        {status === "error" && truck && (
          <>
            <p className="text-sm font-semibold text-muted">{t.orderingFrom}</p>
            <h2 className="mb-3 text-2xl leading-tight font-extrabold">{truckName(truck, locale)}</h2>
            <LoadError title={t.cartLoadErrorTitle} body={t.cartLoadErrorBody} onRetry={retry} />
            <p className="mt-3 text-sm text-muted">{t.itemCount(count)}</p>
          </>
        )}

        {status === "ready" && truck && (
          <>
            <section className="flex items-center gap-4 rounded-panel bg-ink p-4 text-snowy-white">
              {truckLogo(truck.id) && <Image src={truckLogo(truck.id)!} alt="" width={80} height={80} className="size-20 shrink-0 rounded-panel bg-white p-2 object-contain" />}
              <div><p className="text-sm">{t.orderingFrom}</p><h2 className="text-2xl leading-tight font-extrabold">{truckName(truck, locale)}</h2></div>
            </section><h2 className="mt-6 text-2xl font-extrabold">{t.yourItems}</h2>

            {/* Saved dishes that the menu no longer has. Named as a problem, never dropped quietly. */}
            {missingIds.length > 0 && (
              <section role="alert" className="mt-3 rounded-panel bg-warning-surface p-4 text-warning">
                <p className="font-bold">{t.missingItems(missingIds.length)}</p>
                <button
                  type="button"
                  className={`${primaryButton} mt-3`}
                  onClick={() => missingIds.forEach((id) => setQuantity(truck, id, 0))}
                >
                  {t.removeMissing(missingIds.length)}
                </button>
              </section>
            )}

            {lines.length > 0 && (
              <ul className="mt-3 space-y-3">
                {lines.map(({ item, quantity }) => {
                  const name = itemName(item, locale);
                  return (
                    <li key={item.id} className="rounded-panel border border-divider p-3">
                      <div className={`grid ${dishPhoto(item.id) ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-1"} items-center gap-3`}>
                        {dishPhoto(item.id) && <Image src={dishPhoto(item.id)!} alt="" width={96} height={96} className="size-[72px] rounded-control object-cover" />}
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold">{name}</h3>
                          <p className="text-sm text-muted">
                            <Money amount={item.price_kwd} locale={locale} />
                          </p>
                        </div>
                        <div className="col-span-2 flex justify-end">{item.sold_out ? (
                          <button
                            type="button"
                            onClick={() => setQuantity(truck, item.id, 0)}
                            className="inline-flex min-h-11 shrink-0 items-center rounded-control border border-outline px-3.5 font-bold hover:border-ink hover:bg-subtle"
                          >
                            {t.removeItem(name)}
                          </button>
                        ) : (
                          <QuantityStepper
                            name={name}
                            quantity={quantity}
                            onChange={(q) => setQuantity(truck, item.id, q)}
                          />
                        )}</div>
                      </div>
                      {item.sold_out && (
                        <p role="alert" className="mt-2 rounded-control bg-warning-surface px-3 py-2 text-sm font-semibold text-warning">
                          {t.soldOutItem(name)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <Link href={`/trucks/${truck.id}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4">+ {t.addMore}</Link>
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-paper pb-[env(safe-area-inset-bottom)]"><div className="mx-auto max-w-xl px-4 pb-3 md:px-6">
            <div className="flex items-baseline justify-between gap-3 py-4">
              <p>
                <span className="text-lg font-bold">{t.total}</span>{" "}
                <span className="text-sm text-muted">· {t.itemCount(count)}</span>
              </p>
              <Money amount={total} locale={locale} className="text-2xl font-extrabold" />
            </div>

            <div className="space-y-2">
              {orderable ? (
                <Link href="/checkout" className={primaryButton}>
                  {t.choosePickup}
                  <ArrowForward className="size-5" />
                </Link>
              ) : (
                <button type="button" disabled className={primaryButton}>
                  {missingIds.length + soldOut.length > 0 ? t.fixCartFirst : t.choosePickup}
                </button>
              )}

            </div></div></div>
          </>
        )}
      </main>
    </div>
  );
}
