"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import type { MenuItem, Truck } from "@/lib/data";
import { categoryName, itemDescription, itemName, truckName } from "@/lib/i18n";
import { dishPhoto } from "@/lib/images";
import { useLocale } from "@/lib/locale";
import { formatKwd, sumKwd } from "@/lib/money";
import { useCartLines } from "@/lib/use-cart-lines";
import { CartBar } from "./cart-bar";
import { QuantityStepper } from "./quantity-stepper";
import { Money, PlusIcon, primaryButton, secondaryButton } from "./ui";

/**
 * A truck's dishes, grouped under the categories the menu itself has, with
 * tabs to show one category at a time; then the "replace your cart?"
 * question and the cart bar pinned above the bottom navigation.
 *
 * Each row keeps a dish's name, price and its control together: a round
 * "+" to add it, which becomes a quantity stepper once it is in the cart.
 */
export function MenuList({ truck, items, closed }: { truck: Truck; items: MenuItem[]; closed: boolean }) {
  const { locale, t } = useLocale();
  const { cart, count, setQuantity, replaceWith } = useCart();
  const other = useCartLines(); // the saved cart, which may belong to another truck
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<MenuItem | null>(null);

  // The tabs come from the menu's own categories, in the order they first appear.
  const [category, setCategory] = useState<string | null>(null);
  const categories = [...new Set(items.map((item) => item.category))];
  const groups = categories
    .filter((name) => category === null || name === category)
    .map((name) => ({ name, items: items.filter((item) => item.category === name) }));
  const tab = (on: boolean) =>
    `relative inline-flex min-h-11 shrink-0 items-center px-3 text-base transition-colors duration-[120ms] ease-out ${
      on ? "font-extrabold text-ink" : "font-semibold text-muted hover:text-ink"
    }`;
  const underline = <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-red-orange" />;

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
      {categories.length > 1 && (
        <div role="group" aria-label={t.menuCategories} className="-mx-4 flex gap-1 overflow-x-auto border-b border-divider px-4 md:mx-0 md:px-0">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={tab(category === null)}>
            {t.allDishes}
            {category === null && underline}
          </button>
          {categories.map((name) => (
            <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={tab(category === name)}>
              {categoryName(name, locale)}
              {category === name && underline}
            </button>
          ))}
        </div>
      )}

      {groups.map((group) => (
      <section key={group.name} aria-labelledby={`category-${group.name}`}>
      <h2 id={`category-${group.name}`} className="mt-5 mb-1 text-[1.44rem] leading-tight font-extrabold tracking-tight">
        {categoryName(group.name, locale)}
      </h2>
      <ul className="divide-y divide-divider">
        {group.items.map((item) => {
          const name = itemName(item, locale);
          const description = itemDescription(item, locale);
          const quantity = mine[item.id] ?? 0;
          const photo = dishPhoto(item.id);
          // Sold out, a quantity stepper, or "Add": whichever applies to this dish.
          const control = item.sold_out ? (
            <span className="shrink-0 rounded-full bg-subtle px-3 py-1.5 text-sm font-bold text-muted">{t.soldOut}</span>
          ) : quantity > 0 ? (
            <QuantityStepper name={name} quantity={quantity} onChange={(q) => setQuantity(truck, item.id, q)} />
          ) : (
            <button
              type="button"
              disabled={closed}
              aria-label={t.addItem(name)}
              onClick={() => add(item)}
              className="tap-ack inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-divider bg-snowy-white hover:border-ink hover:bg-subtle disabled:cursor-not-allowed disabled:border-divider disabled:text-muted"
            >
              <PlusIcon className="size-5" />
            </button>
          );
          // Allergens the vendor has saved for this dish, e.g. "May contain: Gluten, Milk".
          const mayContain =
            item.allergens.length > 0 ? (
              <p className="text-sm text-muted">
                {t.mayContain(item.allergens.map((code) => t.allergenName[code] ?? code).join(locale === "ar" ? "، " : ", "))}
              </p>
            ) : null;
          const title = <h3 className={`leading-snug font-bold ${item.sold_out ? "text-muted" : ""}`}>{name}</h3>;
          const price = <Money amount={item.price_kwd} locale={locale} className="text-sm" />;

          // With a photo: the photo, then the name and description at full
          // width, then the price and the control on one line. This keeps the
          // words readable at 320 px in English and Arabic.
          if (photo) {
            return (
              <li key={item.id} className="flex items-center gap-2.5 py-3 min-[360px]:gap-3">
                {/* The supplied photo of this dish. Its name is right beside it, so the image stays silent. */}
                <Image
                  src={photo}
                  alt=""
                  width={480}
                  height={480}
                  sizes="(min-width: 640px) 96px, 72px"
                  className={`h-[62px] w-[66px] shrink-0 rounded-control object-cover outline outline-1 -outline-offset-1 outline-black/10 sm:h-20 sm:w-24 ${
                    item.sold_out ? "opacity-60 grayscale" : ""
                  }`}
                />
                <div className="min-w-0 flex-1">
                  {title}
                  {description && <p className="text-sm text-muted">{description}</p>}
                  {mayContain}
                  <p className="mt-0.5 font-semibold">{price}</p>
                </div>
                {control}
              </li>
            );
          }

          // Without a photo, a simple row completes the layout (DESIGN.md).
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                {title}
                {description && <p className="text-sm text-muted">{description}</p>}
                {mayContain}
                <p className="mt-1 font-bold">{price}</p>
              </div>
              {control}
            </li>
          );
        })}
      </ul>
      </section>
      ))}
      <p className="mt-3 text-sm text-muted">{t.oneTruck}</p>

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
