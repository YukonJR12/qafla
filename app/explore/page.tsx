import Image from "next/image";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { SavedCartNotice } from "@/components/saved-cart-notice";
import { ArrowForward, Isolate, PickupSticker, StateLabel } from "@/components/ui";
import { fetchTrucksTonight, type TruckTonight } from "@/lib/data";
import { dictionary, truckBlurb, truckCuisine, truckName, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { supabasePublic } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";

// Availability changes minute by minute, so this page is rendered on every
// request and never cached.
export const dynamic = "force-dynamic";

const FEATURED_TRUCK = "T02"; // Dune Burgers carries the poster (DESIGN.md)

export default async function Explore() {
  const locale = await getLocale();
  const t = dictionary[locale];
  const trucks = await fetchTrucksTonight(supabasePublic());

  const open = trucks.filter((truck) => !truck.closed);
  const closed = trucks.filter((truck) => truck.closed);
  const featured = open.find((truck) => truck.id === FEATURED_TRUCK);
  const rest = open.filter((truck) => truck !== featured);

  return (
    <div className="mx-auto min-h-dvh max-w-[1160px] overflow-x-clip pb-12">
      {/* Park masthead: the Qafla logo is the park's identity, kept apart from any truck's poster. */}
      <header className="border-b border-divider px-4 pt-2 pb-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label={t.homeLabel} className="shrink-0 rounded-control">
            <Image
              src="/brand/qafla-logo.png"
              alt=""
              width={1254}
              height={1254}
              sizes="96px"
              className="size-24"
              preload
            />
          </Link>
          <LanguageSwitch />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted">
          <p>{t.parkHours}</p>
          <p className="font-semibold text-ink">{t.openCount(open.length)}</p>
        </div>
      </header>

      <main className="px-4 pt-4 md:px-6">
        <h1 className="text-[1.75rem] leading-tight font-extrabold">{t.chooseTruck}</h1>

        <SavedCartNotice className="mt-3" />

        <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
          {featured && <Poster truck={featured} locale={locale} />}

          <ul className="divide-y divide-divider border-y border-divider md:self-start">
            {rest.map((truck) => (
              <TruckRow key={truck.id} truck={truck} locale={locale} />
            ))}
          </ul>
        </div>

        {closed.length > 0 && (
          <section aria-labelledby="closed-heading" className="mt-10 md:max-w-[calc(50%-12px)]">
            <h2 id="closed-heading" className="text-lg font-extrabold">
              {t.closedGroup}
            </h2>
            <ul className="mt-2 divide-y divide-divider border-y border-divider">
              {closed.map((truck) => (
                <TruckRow key={truck.id} truck={truck} locale={locale} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

/** What a truck can offer right now, as words. */
function availability(truck: TruckTonight, locale: Locale): string {
  const t = dictionary[locale];
  if (truck.closed) return t.closedTonight;
  if (!truck.nextSlot) return t.noSlotsToday;
  return t.nextPickup(formatSlot(truck.nextSlot, locale));
}

/** The featured truck's poster: two-line name, burger card, marker arrow and pickup sticker. */
function Poster({ truck, locale }: { truck: TruckTonight; locale: Locale }) {
  const t = dictionary[locale];
  const name = truckName(truck, locale);
  const words = name.split(" ");

  return (
    <Link
      href={`/trucks/${truck.id}`}
      aria-label={t.orderFromLabel(name, availability(truck, locale))}
      className="poster-grid relative block rounded-poster bg-red-orange p-4 pb-5 text-snowy-white"
    >
      <p className="inline-block rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white">
        {truckCuisine(truck, locale)}
      </p>

      <h2 className="poster-title mt-3 text-[clamp(44px,13.5vw,72px)] md:text-[clamp(44px,6.4vw,84px)]">
        {words.map((word) => (
          <span key={word} className="block">
            {word}
          </span>
        ))}
      </h2>

      <div className="relative mt-1 h-36">
        {/* The marker arrow turns from the name toward the sticker. Decoration only. */}
        <svg
          viewBox="0 0 100 80"
          aria-hidden
          fill="none"
          stroke="var(--color-yellow-punk)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute start-1 top-2 h-20 w-24 overflow-visible rtl:-scale-x-100"
        >
          <path d="M70 6C46 4 20 20 16 62" />
          <path d="M4 50l12 14 14-10" />
        </svg>

        {/* The food on a white card, tilted 4 degrees and breaking the poster's edge. */}
        <div className="absolute -end-7 -bottom-1 size-36 -rotate-[4deg] overflow-hidden rounded-panel border border-ink bg-white shadow-[0_10px_24px_rgb(16_16_16/0.35)] rtl:rotate-[4deg]">
          <Image
            src="/trucks/dune-burgers.webp"
            alt=""
            width={640}
            height={640}
            sizes="176px"
            className="size-full object-cover"
          />
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        {truck.nextSlot ? (
          <PickupSticker>
            <Isolate>{availability(truck, locale)}</Isolate>
          </PickupSticker>
        ) : (
          <StateLabel>{availability(truck, locale)}</StateLabel>
        )}
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-bold text-snowy-white">
          {t.seeMenu}
          <ArrowForward className="size-4" />
        </span>
      </div>
    </Link>
  );
}

/** A plain row for every other truck: name, cuisine, what it serves, next pickup. */
function TruckRow({ truck, locale }: { truck: TruckTonight; locale: Locale }) {
  return (
    <li>
      <Link
        href={`/trucks/${truck.id}`}
        className="flex items-center justify-between gap-3 py-3.5 transition-colors duration-[120ms] ease-out hover:bg-subtle"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{truckName(truck, locale)}</h2>
          <p className="text-sm text-muted">
            {truckCuisine(truck, locale)} · {truckBlurb(truck, locale)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-end text-sm font-bold">
          {truck.nextSlot && !truck.closed ? (
            <Isolate className="rounded-full border border-outline px-2.5 py-1">
              {formatSlot(truck.nextSlot, locale)}
            </Isolate>
          ) : (
            <span className="max-w-[9.5rem] text-muted">{availability(truck, locale)}</span>
          )}
          <ArrowForward className="size-4 text-muted" />
        </div>
      </Link>
    </li>
  );
}
