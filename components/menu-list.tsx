"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import type { MenuItem, Truck } from "@/lib/data";
import { itemDescription, itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { formatKwd, sumKwd } from "@/lib/money";
import { useCartLines } from "@/lib/use-cart-lines";
import { QuantityStepper } from "./quantity-stepper";
import { ArrowForward, Money, PlusIcon, primaryButton, primaryButtonSplit, secondaryButton } from "./ui";

/**
 * A truck's dishes with add buttons, the "replace your cart?" question and
 * the cart bar pinned to the bottom of the screen.
 */
export function MenuList({ truck, items, closed }: { truck: Truck; items: MenuItem[]; closed: boolean }) {
  const { locale, t } = useLocale();
  const { cart, count, setQuantity, replaceWith } = useCart();
  const other = useCartLines(); // the saved cart, which may belong to another truck
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<MenuItem | null>(null);

  const mine = cart?.truckId === truck.id ? cart.items : {};
  const myTotal = sumKwd(items.map((item) => ({ price: item.price_kwd, quantity: mine[item.id] ?? 0 })));
  const myCount = cart?.truckId === truck.id ? count : 0;

  function add(item: MenuItem) {
    // One truck per cart. The question is asked only now, when the customer
    // first adds a dish from a different truck, never while they just browse.
    if (cart && cart.truckId !== truck.id && count > 0) {
      setPending(item);
      dialog.current?.showModal();
      return;
    }
    setQuantity(truck, item.id, 1);
  }

  return (
    <>
      <ul className="divide-y divide-divider">
        {items.map((item) => {
          const name = itemName(item, locale);
          const description = itemDescription(item, locale);
          const quantity = mine[item.id] ?? 0;
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <h3 className={`text-lg font-semibold ${item.sold_out ? "text-muted" : ""}`}>{name}</h3>
                {description && <p className="text-sm text-muted">{description}</p>}
                <p className="mt-1 font-bold">
                  <Money amount={item.price_kwd} locale={locale} />
                </p>
              </div>

              {item.sold_out ? (
                <span className="shrink-0 rounded-control border border-outline px-2.5 py-1 text-sm font-semibold text-muted">
                  {t.soldOut}
                </span>
              ) : quantity > 0 ? (
                <QuantityStepper name={name} quantity={quantity} onChange={(q) => setQuantity(truck, item.id, q)} />
              ) : (
                <button
                  type="button"
                  disabled={closed}
                  aria-label={t.addItem(name)}
                  onClick={() => add(item)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control border border-outline bg-snowy-white ps-3 pe-4 text-base font-bold transition-colors duration-[120ms] ease-out hover:border-ink hover:bg-subtle disabled:cursor-not-allowed disabled:border-divider disabled:text-muted"
                >
                  <PlusIcon className="size-5" />
                  {t.add}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Cart bar: opaque, with a top rule, above the phone's safe area. */}
      {myCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-snowy-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-xl px-4 py-3 md:px-6">
            <Link href="/cart" className={primaryButtonSplit}>
              <span className="flex items-center gap-2.5">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-yellow-punk text-sm font-extrabold text-ink tabular-nums">
                  {myCount}
                </span>
                {t.viewCart}
              </span>
              <span className="flex items-center gap-2">
                <Money amount={myTotal} locale={locale} />
                <ArrowForward className="size-5" />
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Closing the dialog returns focus to the Add button that opened it (native <dialog> behaviour). */}
      <dialog
        ref={dialog}
        aria-labelledby="replace-title"
        onClose={() => setPending(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-panel bg-snowy-white p-5 text-ink"
      >
        <h2 id="replace-title" className="text-xl font-extrabold">
          {t.replaceTitle}
        </h2>
        {cart && (
          <p className="mt-2 text-base">
            {t.replaceBody(
              count,
              truckName({ id: cart.truckId, name: cart.truckName }, locale),
              formatKwd(other.total, locale),
            )}
          </p>
        )}
        {pending && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-divider pt-3 text-sm">
            <dt className="text-muted">{t.replaceNewItem}</dt>
            <dd className="font-semibold">{itemName(pending, locale)}</dd>
            <dt className="text-muted">{t.replaceNewTruck}</dt>
            <dd className="font-semibold">{truckName(truck, locale)}</dd>
          </dl>
        )}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              if (pending) replaceWith(truck, pending.id);
              dialog.current?.close();
            }}
          >
            {t.replaceConfirm}
          </button>
          <button type="button" className={secondaryButton} onClick={() => dialog.current?.close()}>
            {t.replaceKeep}
          </button>
        </div>
      </dialog>
    </>
  );
}
