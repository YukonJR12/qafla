"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { TruckList } from "@/components/truck-list";
import { TruckLogo } from "@/components/truck-logo";
import { primaryButton, secondaryButton } from "@/components/ui";
import { fetchDishNames, fetchTrucksTonight, type TruckTonight } from "@/lib/data";
import { truckName, truckCuisine, truckBlurb } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { parkTruck, parkWords } from "@/lib/park-map";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";
import type { DishName } from "@/lib/truck-search";

const Scene = dynamic(() => import("@/components/park-scene"), { ssr: false });
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MapPage() {
  const { locale, t } = useLocale();
  const words = parkWords[locale];
  const search = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => parkTruck(search.get("truck"))?.id ?? null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const [reset, setReset] = useState(0);
  const [list, setList] = useState(false);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<{ trucks: TruckTonight[]; dishes: DishName[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    let reading = false;
    async function read() {
      if (reading || document.hidden) return;
      reading = true;
      try {
        const db = supabaseBrowser();
        const [trucks, dishes] = await Promise.all([fetchTrucksTonight(db), fetchDishNames(db)]);
        if (alive) { setData({ trucks, dishes }); setError(false); }
      } catch { if (alive) setError(true); }
      finally { reading = false; }
    }
    void read();
    const timer = setInterval(read, 30_000);
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", read); document.removeEventListener("visibilitychange", read); };
  }, [retry]);

  const truck = data?.trucks.find((item) => item.id === selected);
  const fallback = <p className="relative z-20 h-full bg-snowy-white p-5" role="status">{words.fallback} <button className={secondaryButton} onClick={() => setList(true)}>{words.list}</button></p>;
  return <main className="mx-auto flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] max-w-5xl flex-col md:h-[calc(100dvh-5rem)]">
    <header className="shrink-0 px-4 pt-3">
      <div className="flex items-center justify-between gap-2"><h1 className="text-2xl font-extrabold">{words.title}</h1><LanguageSwitch /></div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1" aria-label={words.title}>
          <button aria-pressed={!list} onClick={() => { if (list) setReady(false); setList(false); }} className={`${list ? secondaryButton : primaryButton} w-auto! whitespace-nowrap px-3! py-2!`}>{words.map}</button>
          <button aria-pressed={list} onClick={() => setList(true)} className={`${list ? primaryButton : secondaryButton} w-auto! whitespace-nowrap px-3! py-2!`}>{words.list}</button>
        </div>
        {!list && <button ref={resetButton} className="min-h-11 rounded-control px-2 text-sm font-bold underline" onClick={() => { setSelected(null); setReset((v) => v + 1); }}>{words.reset}</button>}
      </div>
    </header>
    {error && <p role="alert" className="px-4 text-sm">{words.error} <button className="min-h-11 underline" onClick={() => setRetry((v) => v + 1)}>{words.retry}</button></p>}
    {!data ? <p role="status" className="p-4">{t.loading}</p> : list ? <div className="overflow-y-auto px-4 pb-8"><TruckList trucks={data.trucks} dishes={data.dishes} /></div> : <>
      <p className="px-4 pt-2 text-center text-xs text-muted">{words.hint}</p>
      <div className="relative min-h-[230px] flex-1" data-testid="park" data-ready={ready} data-selected={selected ?? ""}>
        {!ready && <p role="status" className="absolute inset-x-0 top-4 text-center">{words.loading}</p>}
        <SceneBoundary fallback={fallback}><Scene trucks={data.trucks} selected={selected} reset={reset} onSelect={setSelected} onReady={() => setReady(true)} fallback={fallback} /></SceneBoundary>
      </div>
      {truck ? <section aria-label={words.details} className="max-h-[32dvh] shrink-0 overflow-y-auto rounded-t-[24px] border-t border-divider bg-snowy-white px-4 pt-3 pb-3 shadow-[0_-4px_18px_#1010100d]">
        <div className="flex items-center gap-3">
          <TruckLogo truck={truck} className="size-12" />
          <div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold" aria-live="polite">{truckName(truck, locale)}</h2><p className="text-sm text-muted">{truckCuisine(truck, locale)}</p></div>
          <button aria-label={words.close} className="size-11 shrink-0 rounded-full border border-divider text-2xl" onClick={() => { setSelected(null); setReset((v) => v + 1); resetButton.current?.focus(); }}>×</button>
        </div>
        <p className="mt-1 text-sm">{truckBlurb(truck, locale)}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">{truck.closed ? (truck.closedBy === "vendor" ? t.pausedNow : t.closedTonight) : truck.nextSlot ? t.nextPickup(formatSlot(truck.nextSlot, locale)) : t.noSlotsToday}</p>
          <Link href={`/trucks/${truck.id}`} className={primaryButton}>{words.menu}</Link>
        </div>
      </section> : <p className="shrink-0 px-4 pb-4 text-center text-sm text-muted">{words.tap}</p>}
    </>}
  </main>;
}
