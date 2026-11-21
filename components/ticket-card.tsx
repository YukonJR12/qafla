"use client";

import { useLocale } from "@/lib/locale";
import { truckName } from "@/lib/i18n";
import { formatSlot } from "@/lib/time";
import { TruckLogo } from "./truck-logo";
import { Isolate } from "./ui";

/**
 * The black pickup ticket, used for an active order on Orders and at the
 * top of the live ticket.
 *
 * Reading order: whose food it is (truck logo and name) and where it has
 * got to (status), then the pickup time, which is the largest thing on the
 * card, then the stub under the dashed line (`children`): the order
 * reference, the total, an action.
 *
 * The two notches are cut from the card's edges where the stub tears off.
 * An order that was cancelled or rejected has a quieter time, because
 * there is nothing to pick up.
 */
export function TicketCard({
  truck,
  slot,
  status,
  children,
}: {
  truck: { id: string; name: string };
  slot: string;
  status: string;
  /** The stub under the dashed line. */
  children: React.ReactNode;
}) {
  const { locale, t } = useLocale();
  const over = status === "cancelled" || status === "rejected";
  return (
    <div className="relative rounded-poster bg-ink p-4 text-snowy-white sm:p-5">
      <div className="flex items-center gap-3">
        <TruckLogo truck={truck} className="size-14 border-0!" sizes="56px" />
        <p className="min-w-0 flex-1 text-xl leading-tight font-extrabold text-balance">{truckName(truck, locale)}</p>
        {/* Re-keyed by status, so a live change gives the label a short bump. */}
        <span
          key={status}
          className={`bump shrink-0 rounded-control px-2.5 py-1 text-sm font-bold ${
            status === "ready" ? "bg-yellow-punk text-ink" : "bg-snowy-white text-ink"
          }`}
        >
          {t.statusName[status] ?? status}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold">{t.scheduledPickup}</p>
      <p className={`text-[clamp(2.75rem,15vw,4rem)] leading-none font-black tracking-tight ${over ? "text-snowy-white/60 line-through" : "text-yellow-punk"}`}>
        <Isolate>{formatSlot(slot, locale)}</Isolate>
      </p>

      {/* The tear line, with a notch cut from each edge. */}
      <div className="relative mt-4 border-t border-dashed border-snowy-white/70">
        <span aria-hidden className="absolute -start-7 -top-3 size-6 rounded-full bg-snowy-white sm:-start-8" />
        <span aria-hidden className="absolute -end-7 -top-3 size-6 rounded-full bg-snowy-white sm:-end-8" />
      </div>
      <div className="pt-3">{children}</div>
    </div>
  );
}
