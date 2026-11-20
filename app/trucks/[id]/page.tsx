import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartSummary } from "@/components/cart-bar";
import { LanguageSwitch } from "@/components/language-switch";
import { MenuList } from "@/components/menu-list";
import { SavedCartNotice } from "@/components/saved-cart-notice";
import { TruckLogo } from "@/components/truck-logo";
import { ArrowBack, Isolate, PickupSticker, StateLabel } from "@/components/ui";
import { fetchClosed, fetchMenu, fetchSlots, fetchTruck, nextBookable } from "@/lib/data";
import { dictionary, truckBlurb, truckName } from "@/lib/i18n";
import { truckLogo, truckPhoto } from "@/lib/images";
import { getLocale } from "@/lib/locale-server";
import { supabasePublic } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";

export const dynamic = "force-dynamic"; // menu state and availability are live

// A truck's menu. The compact poster carries the truck's own logo (or its
// food photo when it has no logo yet); the dishes follow with their photos.
// From 1024 px the menu sits beside a 320 px cart summary.
export default async function TruckMenu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = dictionary[locale];
  const db = supabasePublic();

  const truck = await fetchTruck(db, id);
  if (!truck) notFound();

  const [items, slots, closed] = await Promise.all([fetchMenu(db, id), fetchSlots(db, id), fetchClosed(db, id)]);
  const next = closed ? null : nextBookable(slots);
  const photo = truckPhoto(truck.id);

  return (
    // pb leaves room for the last dish above the cart bar.
    <div className="mx-auto min-h-dvh max-w-xl pb-28 lg:max-w-[1160px] lg:px-6 lg:pt-4 lg:pb-12">
      {/* Compact poster: the same lettering and sticker as Explore, with less height. */}
      <header className="poster-grid overflow-hidden bg-red-orange px-4 pt-3 pb-4 text-snowy-white md:px-6 lg:rounded-poster">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/explore"
            aria-label={t.backToTrucks}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-ink text-snowy-white transition-colors duration-[120ms] ease-out hover:bg-ink-pressed"
          >
            <ArrowBack className="size-5" />
          </Link>
          <LanguageSwitch onPoster />
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="poster-title text-[clamp(34px,10.5vw,52px)] text-balance lg:text-[64px]">{truckName(truck, locale)}</h1>
            <p className="mt-2 text-base font-medium text-ink">{truckBlurb(truck, locale)}</p>
          </div>
          {/* The open corner: the truck's logo on a white tile, or its food photo. Level labels, tilted picture. */}
          {truckLogo(truck.id) ? (
            <TruckLogo
              truck={truck}
              className="size-24 rotate-3 border-ink! rtl:-rotate-3 lg:size-32"
              sizes="(min-width: 1024px) 128px, 96px"
              preload
            />
          ) : (
            photo && (
              <div className="size-20 shrink-0 rotate-3 overflow-hidden rounded-control border border-ink bg-white rtl:-rotate-3 lg:size-28">
                <Image src={photo} alt="" width={640} height={640} sizes="112px" className="size-full object-cover" preload />
              </div>
            )
          )}
        </div>

        <div className="mt-3">
          {next ? (
            <PickupSticker>
              <Isolate>{t.nextPickup(formatSlot(next.slot_start, locale))}</Isolate>
            </PickupSticker>
          ) : (
            <StateLabel>{closed ? t.closedTonight : t.noSlotsToday}</StateLabel>
          )}
        </div>
      </header>

      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <main className="px-4 pt-4 md:px-6 lg:px-0 lg:pt-0">
          {/* Shown on phones, where another truck's cart would otherwise be out of sight. */}
          <SavedCartNotice hideForTruck={truck.id} className="mb-4 lg:hidden" />

          {closed && (
            <p className="mb-4 rounded-control bg-warning-surface px-3 py-2 text-sm font-semibold text-warning">
              {t.closedMenuNote}
            </p>
          )}

          <div className="flex items-baseline justify-between gap-3 border-b border-divider pb-2">
            <h2 className="text-xl font-extrabold">{t.menu}</h2>
            <p className="text-sm text-muted">{t.oneTruck}</p>
          </div>

          <MenuList truck={truck} items={items} closed={closed} />
        </main>

        <div className="hidden lg:block">
          <CartSummary />
        </div>
      </div>
    </div>
  );
}
