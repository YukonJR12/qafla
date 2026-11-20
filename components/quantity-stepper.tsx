"use client";

import { MAX_QUANTITY } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { MinusIcon, PlusIcon } from "./ui";

/**
 * Minus, the quantity, plus. One to ten of a dish; minus at one removes it.
 * Each button is 44 px square so it is easy to hit with a thumb.
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
    "inline-flex size-11 items-center justify-center rounded-control transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div role="group" aria-label={t.quantityOf(name, quantity)} className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={quantity === 1 ? t.remove(name) : t.decrease(name)}
        onClick={() => onChange(quantity - 1)}
        className={`${button} border border-outline bg-snowy-white text-ink hover:border-ink hover:bg-subtle`}
      >
        <MinusIcon className="size-5" />
      </button>
      <span aria-hidden className="w-7 text-center text-base font-bold tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t.increase(name)}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
        className={`${button} bg-ink text-snowy-white hover:bg-ink-pressed`}
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  );
}
