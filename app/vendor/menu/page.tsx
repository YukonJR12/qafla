"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { LanguageSwitch } from "@/components/language-switch";
import { ArrowForward, Money } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchMenu, type MenuItem } from "@/lib/data";
import { itemDescription, itemName, truckName } from "@/lib/i18n";
import { dishPhoto } from "@/lib/images";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";

// The vendor's Menu: every dish on their own truck, with what customers
// currently read about it. Choosing a dish opens its editor, where the
// description and allergens can be written by hand or drafted from a photo.
//
// Which truck this is comes from the signed-in account's database profile
// (the launch gate only shows this page to a vendor with a truck).
export default function VendorMenuPage() {
  const { locale, t } = useLocale();
  const { account } = useAccount();
  const truck = account.status === "signed-in" ? account.truck : null;
  const truckId = truck?.id ?? null;

  const [menu, setMenu] = useState<{ truckId: string; items: MenuItem[] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!truckId) return;
    let current = true;
    fetchMenu(supabaseBrowser(), truckId).then(
      (items) => current && setMenu({ truckId, items }),
      () => current && setMenu({ truckId, items: null }),
    );
    return () => {
      current = false;
    };
  }, [truckId, attempt]);
  const shown = menu && menu.truckId === truckId ? menu : null;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider">
        <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">
              {t.appName}
              {truck && ` · ${truckName(truck, locale)}`}
            </p>
            <h1 className="text-[1.75rem] leading-tight font-extrabold">{t.menuEditorTitle}</h1>
          </div>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-4 pt-4 pb-10 md:px-6">
        <p className="text-muted">{t.menuEditorLead}</p>

        {!shown ? (
          <div role="status" aria-label={t.loading} className="mt-4 space-y-3">
            <div className="h-20 rounded-panel bg-subtle" />
            <div className="h-20 rounded-panel bg-subtle" />
            <div className="h-20 rounded-panel bg-subtle" />
          </div>
        ) : !shown.items ? (
          <div className="mt-4">
            <LoadError title={t.menuLoadErrorTitle} body={t.ordersLoadErrorBody} onRetry={() => setAttempt((n) => n + 1)} />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-divider border-y border-divider lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0 lg:border-y-0">
            {shown.items.map((item) => {
              const name = itemName(item, locale);
              const description = itemDescription(item, locale);
              const photo = dishPhoto(item.id);
              return (
                <li key={item.id} className="lg:border-b lg:border-divider">
                  <Link
                    href={`/vendor/menu/${item.id}`}
                    aria-label={t.menuEdit(name)}
                    className="flex min-h-16 items-center gap-3 py-3 transition-colors duration-[120ms] ease-out hover:bg-subtle"
                  >
                    {photo && (
                      <Image
                        src={photo}
                        alt=""
                        width={480}
                        height={480}
                        sizes="56px"
                        className="size-14 shrink-0 rounded-control border border-divider object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg leading-snug font-semibold">{name}</span>
                        <Money amount={item.price_kwd} locale={locale} className="text-sm text-muted" />
                        {item.sold_out && <span className="text-sm font-semibold text-muted">· {t.soldOut}</span>}
                      </span>
                      {description ? (
                        <span className="block text-sm text-muted">{description}</span>
                      ) : (
                        // A dish that still needs words is the one to notice.
                        <span className="mt-0.5 inline-block rounded-control bg-warning-surface px-2 py-0.5 text-sm font-semibold text-warning">
                          {t.menuNoDescription}
                        </span>
                      )}
                      {item.allergens.length > 0 && (
                        <span className="block text-sm text-muted">
                          {t.mayContain(item.allergens.map((code) => t.allergenName[code] ?? code).join(locale === "ar" ? "، " : ", "))}
                        </span>
                      )}
                    </span>
                    <ArrowForward className="size-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">{t.priceUntouched}</p>
      </main>
    </div>
  );
}
