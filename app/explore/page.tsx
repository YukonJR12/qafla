import Image from "next/image";
import { CartBar } from "@/components/cart-bar";
import { LanguageSwitch } from "@/components/language-switch";
import { ScrollMemory } from "@/components/scroll-memory";
import { TruckList } from "@/components/truck-list";
import { fetchDishNames, fetchTrucksTonight } from "@/lib/data";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { supabasePublic } from "@/lib/supabase";

export const dynamic = "force-dynamic"; // opening state and next slots are live

// Explore: the customer's home. The Qafla logo, the park's banner with
// tonight's pickup hours, then every truck in one photo-led list with a
// search box and cuisine filters above it (components/truck-list.tsx).
//
// Everything on a row is read from the database for tonight: whether the
// truck is taking orders, and the next pickup time that can still be booked
// (the same slot logic as checkout). Open trucks come first; a truck that
// is paused or closed for tonight stays in the list and says why.
export default async function Explore() {
  const locale = await getLocale();
  const t = dictionary[locale];
  const db = supabasePublic();
  const [trucks, dishes] = await Promise.all([fetchTrucksTonight(db), fetchDishNames(db)]);

  const open = trucks.filter((truck) => !truck.closed);
  const ordered = [...open, ...trucks.filter((truck) => truck.closed)];

  return (
    // pb leaves room for the last truck above the cart bar.
    <div className="mx-auto min-h-dvh max-w-[1160px] overflow-x-clip pb-28 md:pb-12">
      {/* On a phone the masthead carries the logo; from 768 px the logo is in the bar across the top. */}
      <header className="flex items-center justify-between gap-3 px-4 pt-2 md:justify-end md:px-6 md:pt-4">
        <Image src="/brand/qafla-logo.png" alt="" width={1254} height={1254} sizes="80px" className="size-20 md:hidden" preload />
        <LanguageSwitch />
      </header>

      <main className="px-4 pt-1 md:px-6 md:pt-2">
        {/* Coming back from a menu returns to the same place in the list. */}
        <ScrollMemory id="explore" />

        {/* Physical artwork stays on the right in both languages; copy keeps its reading direction. */}
        <div dir="ltr" className="grid min-h-[104px] grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-center gap-2 rounded-poster bg-ink p-3.5 text-snowy-white sm:p-5">
          <div dir={locale === "ar" ? "rtl" : "ltr"}>
            <p className="text-[clamp(1.125rem,5vw,1.7rem)] leading-[1.05] font-extrabold tracking-tight text-balance">{t.parkName}</p>
            <p className="mt-1.5 text-[clamp(0.75rem,3.4vw,1rem)]">{t.parkHoursShort}</p>
          </div>
          <Image src="/brand/qafla-park-art.png" alt="" width={1942} height={809} unoptimized className="pointer-events-none h-auto max-h-28 w-full object-contain" />
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h1 className="text-[1.44rem] leading-tight font-extrabold tracking-tight">{t.exploreTrucksTitle}</h1>
          <p className="flex shrink-0 items-center gap-1.5 font-bold">
            <span aria-hidden className="size-2.5 rounded-full border border-ink bg-yellow-punk" />
            {t.openCount(open.length)}
          </p>
        </div>

        <TruckList trucks={ordered} dishes={dishes} />
      </main>

      {/* The cart stays within reach while choosing a truck. From 768 px it is in the bar across the top instead. */}
      <CartBar showTruck className="md:hidden" />
    </div>
  );
}
