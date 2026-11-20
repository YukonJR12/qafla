"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import type { MenuItem, Truck } from "@/lib/data";
import { itemDescription, itemName, truckName } from "@/lib/i18n";
import { dishPhoto } from "@/lib/images";
import { useLocale } from "@/lib/locale";
import { formatKwd, sumKwd } from "@/lib/money";
import { useCartLines } from "@/lib/use-cart-lines";
import { CartBar } from "./cart-bar";
import { QuantityStepper } from "./quantity-stepper";
import { Money, PlusIcon, primaryButton, secondaryButton } from "./ui";

/**
 * A truck's dishes with their photos and add buttons, the "replace your
 * cart?" question and the cart bar pinned above the bottom navigation.
 */
export function MenuList({ truck, items, closed }: { truck: Truck; items: MenuItem[]; closed: boolean }) {
  const { locale, t } = useLocale();
  const { cart, count, setQuantity, replaceWith } = useCart();
  const other = useCartLines(); // the saved cart, which may belong to another truck
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<MenuItem | null>(null);

  const mine = cart?.truckId === truck.id ? cart.items : {};
  const myTotal = sumKwd(items.map((item) => ({ price: item.price_kwd, quantity: mine[item.id] ?? 0 })));

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
          const photo = dishPhoto(item.id);
          // Sold out, a quantity stepper, or "Add": whichever applies to this dish.
          const control = item.sold_out ? (
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
          );
          const title = <h3 className={`text-lg leading-snug font-semibold ${item.sold_out ? "text-muted" : ""}`}>{name}</h3>;
          const price = <Money amount={item.price_kwd} locale={locale} />;

          // With a photo: the photo, then the name and description at full
          // width, then the price and the control on one line. This keeps the
          // words readable at 320 px in English and Arabic.
          if (photo) {
            return (
              <li key={item.id} className="flex items-start gap-2.5 py-4 min-[360px]:gap-3">
                {/* The supplied photo of this dish. Its name is right beside it, so the image stays silent. */}
                <Image
                  src={photo}
                  alt=""
                  width={480}
                  height={480}
                  sizes="(min-width: 640px) 96px, 72px"
                  className={`size-16 shrink-0 rounded-control border border-divider object-cover min-[360px]:size-18 sm:size-24 ${
                    item.sold_out ? "opacity-60 grayscale" : ""
                  }`}
                />
                <div className="min-w-0 flex-1">
                  {title}
                  {description && <p className="text-sm text-muted">{description}</p>}
                  <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-x-2 gap-y-2">
                    <p className="font-bold">{price}</p>
                    {control}
                  </div>
                </div>
              </li>
            );
          }

          // Without a photo, a simple row completes the layout (DESIGN.md).
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                {title}
                {description && <p className="text-sm text-muted">{description}</p>}
                <p className="mt-1 font-bold">{price}</p>
              </div>
              {control}
            </li>
          );
        })}
      </ul>

      {/* The cart bar: phones and tablets. From 1024 px the summary beside the menu replaces it. */}
      <CartBar onlyTruck={truck.id} total={myTotal} className="lg:hidden" />

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
