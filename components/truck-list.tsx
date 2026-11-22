"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TruckTonight } from "@/lib/data";
import { itemName, truckBlurb, truckCuisine, truckName } from "@/lib/i18n";
import { truckDishPhotos } from "@/lib/images";
import { useLocale } from "@/lib/locale";
import { matchTrucks, type DishName } from "@/lib/truck-search";
import { formatSlot } from "@/lib/time";
import { TruckLogo } from "./truck-logo";
import { Isolate, SearchIcon, XIcon } from "./ui";

/**
 * Explore's list of trucks: a search box, cuisine filters, and one
 * photo-led row per truck.
 *
 * Both controls work on real data. The search looks in every truck's name,
 * cuisine and description and in the names of the dishes on its menu, in
 * English and Arabic (lib/truck-search.ts). The filters are the cuisines
 * the trucks themselves have saved, so a vendor who edits their cuisine
 * changes the filter. Nothing here is invented: there is no prep estimate,
 * because the project has no source for one.
 *
 * Each row: the truck's lead dish with its logo on the corner, then its
 * name, cuisine and the next pickup time that can still be booked, or the
 * reason it is not taking orders. The whole row opens the menu.
 */
export function TruckList({ trucks, dishes }: { trucks: TruckTonight[]; dishes: DishName[] }) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);

  // The filter chips: each cuisine once, in the order the trucks are listed.
  const cuisines = useMemo(() => [...new Set(trucks.map((truck) => truck.cuisine))], [trucks]);

  const shown = useMemo(
    () =>
      matchTrucks(
        trucks.filter((truck) => cuisine === null || truck.cuisine === cuisine),
        dishes,
        query,
        (truck) => [truckName(truck, locale), truckCuisine(truck, locale), truckBlurb(truck, locale)],
        (dish) => itemName(dish, locale),
      ),
    [trucks, dishes, query, cuisine, locale],
  );

  const chip = (on: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-base transition-colors duration-[120ms] ease-out ${
      on ? "border-ink bg-ink text-snowy-white" : "border-divider bg-snowy-white text-ink hover:border-ink"
    }`;

  return (
    <>
      <div role="search" className="relative mt-3">
        <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t.searchTrucks}
          placeholder={t.searchTrucks}
          enterKeyHint="search"
          className="block min-h-12 w-full rounded-control border border-outline bg-white ps-11 pe-12 text-base text-ink placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.clearSearch}
            className="absolute end-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink"
          >
            <XIcon className="size-5" />
          </button>
        )}
      </div>

      {/* One row that scrolls sideways when the cuisines do not fit; the page itself never does. */}
      <div role="group" aria-label={t.filterByCuisine} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <button type="button" aria-pressed={cuisine === null} onClick={() => setCuisine(null)} className={chip(cuisine === null)}>
          {t.allTrucks}
        </button>
        {cuisines.map((value) => {
          const sample = trucks.find((truck) => truck.cuisine === value)!;
          return (
            <button key={value} type="button" aria-pressed={cuisine === value} onClick={() => setCuisine(cuisine === value ? null : value)} className={chip(cuisine === value)}>
              {truckCuisine(sample, locale)}
            </button>
          );
        })}
      </div>

      {/* Announced when the list changes, so a search is not silent. */}
      <p role="status" className="sr-only">
        {t.trucksShown(shown.length)}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-panel bg-subtle p-5 text-center">
          <p className="text-lg font-extrabold">{t.noTrucksMatch}</p>
          <p className="mt-1 text-muted">{t.noTrucksMatchBody}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCuisine(null);
            }}
            className="mt-3 inline-flex min-h-11 items-center rounded-control border border-ink px-4 font-bold"
          >
            {t.showAllTrucks}
          </button>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-divider border-b border-divider md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 md:border-b-0 xl:grid-cols-3">
          {shown.map(({ truck, dishes: found }) => {
            const name = truckName(truck, locale);
            const photo = truckDishPhotos(truck.id)[0];
            const bookable = truck.nextSlot !== null && !truck.closed;
            const state = truck.closed ? (truck.closedBy === "vendor" ? t.pausedNow : t.closedTonight) : t.noSlotsToday;
            return (
              <li key={truck.id}>
                <Link
                  href={`/trucks/${truck.id}`}
                  prefetch={false}
                  aria-label={t.orderFromLabel(name, bookable ? t.nextPickup(formatSlot(truck.nextSlot!, locale)) : state)}
                  className="flex h-full items-stretch gap-3 py-3 transition-colors duration-[120ms] ease-out hover:bg-subtle md:rounded-panel md:border md:border-divider md:p-2 md:hover:border-ink"
                >
                  {/* The lead dish, with the truck's own logo on its corner. */}
                  <span className="relative block h-[88px] w-[34%] max-w-44 shrink-0 self-center">
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        width={480}
                        height={480}
                        sizes="(min-width: 768px) 176px, 40vw"
                        className={`size-full rounded-control object-cover outline outline-1 -outline-offset-1 outline-black/10 ${bookable ? "" : "opacity-60 grayscale"}`}
                      />
                    ) : (
                      <span className="block size-full rounded-control bg-subtle" />
                    )}
                    <TruckLogo truck={truck} className="absolute start-1.5 bottom-1.5 size-9 border-0!" sizes="36px" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                    <span className="text-[1.07rem] leading-snug font-bold text-balance">{name}</span>
                    <span className="text-sm text-muted">{truckCuisine(truck, locale)}</span>
                    {/* Why this truck matched, when it was a dish that did. */}
                    {found.length > 0 && (
                      <span className="text-sm font-semibold">
                        {t.servesDish(found.slice(0, 2).map((dish) => itemName(dish, locale)).join(locale === "ar" ? "، " : ", "))}
                      </span>
                    )}
                    {bookable ? (
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {t.nextPickupLabel}
                        <Isolate className="rounded bg-yellow-punk px-1.5 py-px font-bold">{formatSlot(truck.nextSlot!, locale)}</Isolate>
                      </span>
                    ) : (
                      <span className="mt-1 text-sm font-bold text-muted">{state}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
