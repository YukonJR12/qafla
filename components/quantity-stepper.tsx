"use client";

import { MAX_QUANTITY } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { MinusIcon, PlusIcon } from "./ui";

/**
 * Minus, the quantity, plus, in one outlined pill. One to ten of a dish;
 * minus at one removes it. Each button is 44 px so it is easy to hit with
 * a thumb.
 */
export function QuantityStepper({
  name,
  quantity,
  onChange,
}: {
  name: string;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const { t } = useLocale();
  const button =
    "tap-ack inline-flex size-11 items-center justify-center rounded-full hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div role="group" aria-label={t.quantityOf(name, quantity)} className="flex shrink-0 items-center rounded-full border border-divider bg-snowy-white">
      <button
        type="button"
        aria-label={quantity === 1 ? t.remove(name) : t.decrease(name)}
        onClick={() => onChange(quantity - 1)}
        className={button}
      >
        <MinusIcon className="size-5" />
      </button>
      <span key={quantity} aria-hidden className="quantity-ack w-5 rounded-full text-center text-base font-extrabold tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t.increase(name)}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
        className={button}
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  );
}
