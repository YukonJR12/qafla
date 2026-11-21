import Image from "next/image";
import { CartBar } from "@/components/cart-bar";
import { LanguageSwitch } from "@/components/language-switch";
import { ParkLineArt } from "@/components/line-art";
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

        {/* The park's banner: its name and tonight's pickup hours. The line art is decoration. */}
        <div className="relative flex min-h-[110px] items-center overflow-hidden rounded-poster bg-ink p-5 text-snowy-white">
          <ParkLineArt className="pointer-events-none absolute end-2 bottom-0 h-[5.5rem] w-auto text-red-orange" />
          <div className="relative max-w-[62%]">
            <p className="text-[1.7rem] leading-[1.05] font-extrabold tracking-tight text-balance">{t.parkName}</p>
            <p className="mt-1.5">{t.parkHoursShort}</p>
          </div>
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
