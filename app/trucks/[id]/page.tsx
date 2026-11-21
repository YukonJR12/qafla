import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartSummary } from "@/components/cart-bar";
import { LanguageSwitch } from "@/components/language-switch";
import { MenuList } from "@/components/menu-list";
import { SavedCartNotice } from "@/components/saved-cart-notice";
import { TruckLogo } from "@/components/truck-logo";
import { ArrowBack, BagIcon, Isolate } from "@/components/ui";
import { fetchClosedBy, fetchMenu, fetchSlots, fetchTruck, nextBookable } from "@/lib/data";
import { dictionary, truckBlurb, truckCuisine, truckName } from "@/lib/i18n";
import { truckDishPhotos } from "@/lib/images";
import { getLocale } from "@/lib/locale-server";
import { supabasePublic } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";

export const dynamic = "force-dynamic"; // menu state and availability are live

// A truck's menu. A compact header says whose menu this is: the truck's
// lead dish with its logo on the corner, its name, cuisine and description,
// and the next pickup time that can still be booked. The dishes follow,
// grouped by category (components/menu-list.tsx). From 1024 px the menu
// sits beside a 320 px cart summary.
export default async function TruckMenu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = dictionary[locale];
  const db = supabasePublic();

  const truck = await fetchTruck(db, id);
  if (!truck) notFound();

  const [items, slots, why] = await Promise.all([fetchMenu(db, id), fetchSlots(db, id), fetchClosedBy(db, id)]);
  const closed = why !== null;
  const paused = why === "vendor"; // the vendor's own pause, not the park's closure for tonight
  const next = closed ? null : nextBookable(slots);
  const photo = truckDishPhotos(truck.id)[0];
  const name = truckName(truck, locale);
  const blurb = truckBlurb(truck, locale);

  return (
    // pb leaves room for the last dish above the cart bar.
    <div className="mx-auto min-h-dvh max-w-xl pb-28 lg:max-w-[1160px] lg:px-6 lg:pb-12">
      <header className="px-4 pt-3 md:px-6 lg:px-0 lg:pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/explore"
            aria-label={t.backToTrucks}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-divider bg-snowy-white ps-2.5 pe-3.5 font-bold transition-colors duration-[120ms] ease-out hover:border-ink"
          >
            <ArrowBack className="size-5" />
            <span aria-hidden>{t.trucks}</span>
          </Link>
          <LanguageSwitch />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="relative block w-[38%] max-w-52 shrink-0">
            {photo ? (
              <Image
                src={photo}
                alt=""
                width={480}
                height={480}
                sizes="(min-width: 1024px) 208px, 38vw"
                preload
                className="aspect-[4/3] w-full rounded-panel object-cover outline outline-1 -outline-offset-1 outline-black/10"
              />
            ) : (
              <span className="block aspect-[4/3] w-full rounded-panel bg-subtle" />
            )}
            <TruckLogo truck={truck} className="absolute start-1.5 bottom-1.5 size-12 sm:size-14" sizes="56px" preload />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(1.5rem,7vw,2.25rem)] leading-tight font-extrabold text-balance">{name}</h1>
            <p className="mt-0.5 text-muted">
              {truckCuisine(truck, locale)}
              {blurb && ` · ${blurb}`}
            </p>
            {next ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold">
                <BagIcon className="size-5 text-red-orange" />
                {t.nextPickupLabel}
                <Isolate className="rounded-control bg-yellow-punk px-1.5 py-0.5 font-extrabold">{formatSlot(next.slot_start, locale)}</Isolate>
              </p>
            ) : (
              <p className="mt-1.5 inline-flex rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white">
                {paused ? t.pausedNow : closed ? t.closedTonight : t.noSlotsToday}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <main className="px-4 pt-4 md:px-6 lg:px-0">
          {/* Shown on phones, where another truck's cart would otherwise be out of sight. */}
          <SavedCartNotice hideForTruck={truck.id} className="mb-4 lg:hidden" />

          {closed && (
            <p className="mb-4 rounded-control bg-warning-surface px-3 py-2 text-sm font-semibold text-warning">
              {paused ? t.pausedMenuNote(name) : t.closedMenuNote}
            </p>
          )}

          <MenuList truck={truck} items={items} closed={closed} />
        </main>

        <div className="hidden lg:mt-4 lg:block">
          <CartSummary />
        </div>
      </div>
    </div>
  );
}
