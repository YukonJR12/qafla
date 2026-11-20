import Image from "next/image";
import Link from "next/link";
import { CartBar } from "@/components/cart-bar";
import { LanguageSwitch } from "@/components/language-switch";
import { TruckLogo } from "@/components/truck-logo";
import { ArrowForward, Isolate, PickupSticker, StateLabel } from "@/components/ui";
import { fetchTrucksTonight, type TruckTonight } from "@/lib/data";
import { dictionary, truckBlurb, truckCuisine, truckName, type Locale } from "@/lib/i18n";
import { truckPhoto } from "@/lib/images";
import { getLocale } from "@/lib/locale-server";
import { supabasePublic } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";

// Availability changes minute by minute, so this page is rendered on every
// request and never cached.
export const dynamic = "force-dynamic";

const FEATURED_TRUCK = "T02"; // Dune Burgers carries the poster (DESIGN.md)

// Explore: the customer's home. One truck on the Red Orange poster, the
// others listed with their own logos and next pickup time.
export default async function Explore() {
  const locale = await getLocale();
  const t = dictionary[locale];
  const trucks = await fetchTrucksTonight(supabasePublic());

  const open = trucks.filter((truck) => !truck.closed);
  const closed = trucks.filter((truck) => truck.closed);
  const featured = open.find((truck) => truck.id === FEATURED_TRUCK);
  const rest = open.filter((truck) => truck !== featured);

  return (
    // pb leaves room for the last truck above the cart bar.
    <div className="mx-auto min-h-dvh max-w-[1160px] overflow-x-clip pb-28 md:pb-12">
      {/*
        Park masthead. On a phone it carries the Qafla logo; from 768 px the
        logo is in the bar across the top, so it is not repeated here.
      */}
      <header className="border-b border-divider px-4 pt-2 pb-3 md:px-6 md:pt-4">
        <div className="flex items-center justify-between gap-3">
          <Image
            src="/brand/qafla-logo.png"
            alt=""
            width={1254}
            height={1254}
            sizes="96px"
            className="size-24 md:hidden"
            preload
          />
          <h1 className="hidden text-[2rem] leading-tight font-extrabold md:block">{t.chooseTruck}</h1>
          <LanguageSwitch />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted">
          <p>{t.parkHours}</p>
          <p className="font-semibold text-ink">{t.openCount(open.length)}</p>
        </div>
      </header>

      <main className="px-4 pt-4 md:px-6">
        <h1 className="text-[1.75rem] leading-tight font-extrabold md:hidden">{t.chooseTruck}</h1>

        {/* One column on a phone. From 1024 px the poster keeps 5/12 and the other trucks take the rest, two across. */}
        <div className="mt-4 grid gap-4 md:mt-0 md:grid-cols-2 md:gap-6 lg:grid-cols-[5fr_7fr]">
          {featured && <Poster truck={featured} locale={locale} />}

          <ul
            className={`divide-y divide-divider border-y border-divider md:self-start lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 lg:border-y-0 ${
              featured ? "" : "md:col-span-2 lg:grid-cols-3"
            }`}
          >
            {rest.map((truck) => (
              <TruckRow key={truck.id} truck={truck} locale={locale} />
            ))}
          </ul>
        </div>

        {closed.length > 0 && (
          <section aria-labelledby="closed-heading" className="mt-10">
            <h2 id="closed-heading" className="text-lg font-extrabold">
              {t.closedGroup}
            </h2>
            <ul className="mt-2 divide-y divide-divider border-y border-divider md:max-w-[calc(50%-12px)] lg:grid lg:max-w-none lg:grid-cols-3 lg:gap-3 lg:divide-y-0 lg:border-y-0">
              {closed.map((truck) => (
                <TruckRow key={truck.id} truck={truck} locale={locale} />
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* The cart stays within reach while choosing a truck. From 768 px it is in the bar across the top instead. */}
      <CartBar showTruck className="md:hidden" />
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
  const photo = truckPhoto(truck.id);

  return (
    <Link
      href={`/trucks/${truck.id}`}
      aria-label={t.orderFromLabel(name, availability(truck, locale))}
      className="poster-grid relative block rounded-poster bg-red-orange p-4 pb-5 text-snowy-white md:self-start"
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
        {photo && (
          <div className="absolute -end-7 -bottom-1 size-36 -rotate-[4deg] overflow-hidden rounded-panel border border-ink bg-white shadow-[0_10px_24px_rgb(16_16_16/0.35)] rtl:rotate-[4deg]">
            <Image src={photo} alt="" width={640} height={640} sizes="176px" className="size-full object-cover" />
          </div>
        )}
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

/**
 * Every other truck: its own logo, name, cuisine and next pickup. A plain
 * row on a phone; from 1024 px a bordered card, two or three across.
 */
function TruckRow({ truck, locale }: { truck: TruckTonight; locale: Locale }) {
  return (
    <li>
      <Link
        href={`/trucks/${truck.id}`}
        className="flex h-full items-center gap-3 py-3 transition-colors duration-[120ms] ease-out hover:bg-subtle lg:rounded-panel lg:border lg:border-divider lg:p-3 lg:hover:border-ink"
      >
        <TruckLogo truck={truck} className="size-16 lg:size-20" sizes="80px" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug font-bold">{truckName(truck, locale)}</h2>
          <p className="text-sm text-muted">
            {truckCuisine(truck, locale)} · {truckBlurb(truck, locale)}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold">
            {truck.nextSlot && !truck.closed ? (
              <Isolate className="rounded-full border border-outline px-2.5 py-0.5">{availability(truck, locale)}</Isolate>
            ) : (
              <span className="text-muted">{availability(truck, locale)}</span>
            )}
          </p>
        </div>
        <ArrowForward className="size-4 text-muted" />
      </Link>
    </li>
  );
}
