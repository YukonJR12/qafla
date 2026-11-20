"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { StatusChip } from "@/components/kitchen-ticket";
import { LanguageSwitch } from "@/components/language-switch";
import { TruckLogo } from "@/components/truck-logo";
import { ArrowForward, Isolate, Money, primaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchMyOrders, type MyOrder } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { splitOrders } from "@/lib/orders";
import { supabaseBrowser } from "@/lib/supabase";
import { formatDay, formatSlot, kuwaitNow } from "@/lib/time";
import { useLiveOrders } from "@/lib/use-live-orders";

// Orders: the signed-in customer's own orders. Tonight's unfinished orders
// lead, earliest pickup first; everything else is listed below as past
// orders. Each row opens that order's live ticket (/orders/<id>), where the
// customer follows the pickup, can cancel while it is "placed", and sees or
// leaves a rating once it is collected.
//
// The list is read from the database for this account only, and row-level
// security would refuse anyone else's orders even if this page asked.
export default function OrdersPage() {
  const { t } = useLocale();
  const { account } = useAccount();
  const userId = account.status === "signed-in" ? account.userId : null;

  const [list, setList] = useState<{ userId: string; orders: MyOrder[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const readNumber = useRef(0); // so an older, slower read never overwrites a newer one

  const reread = useCallback(async () => {
    if (!userId) return;
    const mine = ++readNumber.current;
    try {
      const orders = await fetchMyOrders(supabaseBrowser(), userId);
      if (mine !== readNumber.current) return;
      setList({ userId, orders });
      setFailed(false);
    } catch (error) {
      if (mine === readNumber.current) setFailed(true);
      throw error;
    }
  }, [userId]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  // A status change on any of this customer's orders nudges a re-read.
  const live = useLiveOrders({
    enabled: userId !== null,
    channel: `my-orders-${userId}`,
    filter: `customer_id=eq.${userId}`,
    reread,
  });

  const shown = list && list.userId === userId ? list.orders : null; // never another account's list
  const { active, past } = splitOrders(shown ?? [], kuwaitNow().date);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider">
        <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted md:hidden">{t.appName}</p>
            <h1 className="text-[1.75rem] leading-tight font-extrabold">{t.ordersTitle}</h1>
          </div>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-4 pt-4 pb-10 md:px-6">
        {!shown ? (
          failed ? (
            <LoadError title={t.ordersLoadErrorTitle} body={t.ordersLoadErrorBody} onRetry={() => reread().catch(() => {})} />
          ) : (
            <div role="status" aria-label={t.loading} className="grid gap-3 lg:grid-cols-2">
              <div className="h-36 rounded-panel bg-subtle" />
              <div className="h-36 rounded-panel bg-subtle" />
            </div>
          )
        ) : shown.length === 0 ? (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.noOrdersYet}</h2>
            <p className="mt-2 text-muted">{t.noOrdersCustomerBody}</p>
            <Link href="/explore" className={`${primaryButton} mt-6`}>
              {t.exploreTrucks}
              <ArrowForward className="size-5" />
            </Link>
          </div>
        ) : (
          <>
            {live === "reconnecting" && (
              <p role="status" className="mb-3 text-sm font-semibold text-muted">
                {t.reconnecting}
              </p>
            )}

            <section aria-labelledby="active-title">
              <h2 id="active-title" className="text-lg font-extrabold">
                {t.activeOrders}
              </h2>
              {active.length === 0 ? (
                <p className="mt-2 rounded-panel bg-subtle p-4 text-muted">{t.noActiveOrders}</p>
              ) : (
                <ul className="mt-2 grid gap-3 lg:grid-cols-2">
                  {active.map((order) => (
                    <li key={order.id}>
                      <ActiveOrder order={order} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {past.length > 0 && (
              <section aria-labelledby="past-title" className="mt-8">
                <h2 id="past-title" className="text-lg font-extrabold">
                  {t.pastOrders}
                </h2>
                <ul className="mt-2 divide-y divide-divider border-y border-divider lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0 lg:border-y-0">
                  {past.map((order) => (
                    <li key={order.id} className="lg:border-b lg:border-divider">
                      <PastOrder order={order} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** An order the truck is still working on: the pickup time leads, as on the ticket. */
function ActiveOrder({ order }: { order: MyOrder }) {
  const { locale, t } = useLocale();
  const truck = order.trucks ?? { id: order.truck_id, name: "" };
  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-panel border border-ink p-4 transition-colors duration-[120ms] ease-out hover:bg-subtle"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{t.pickUpAt}</p>
          <p className="text-4xl leading-none font-extrabold tracking-tight">
            <Isolate>{formatSlot(order.slot_start, locale)}</Isolate>
          </p>
          <p className="mt-1.5 text-lg leading-snug font-extrabold">{truckName(truck, locale)}</p>
        </div>
        <TruckLogo truck={truck} className="size-14" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-dashed border-outline pt-3">
        {/* Re-keyed by status, so a live change gives the label a short bump. */}
        <span key={order.status} className="bump inline-flex">
          <StatusChip status={order.status} />
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Isolate>{order.ticket_ref}</Isolate>
          <span aria-hidden>·</span>
          <Money amount={order.total_kwd} locale={locale} />
        </span>
      </div>
      <span className="mt-3 flex items-center justify-end gap-1.5 text-sm font-bold">
        {t.openTicket}
        <ArrowForward className="size-4" />
      </span>
    </Link>
  );
}

/** A finished, cancelled or older order: one compact row. */
function PastOrder({ order }: { order: MyOrder }) {
  const { locale } = useLocale();
  const truck = order.trucks ?? { id: order.truck_id, name: "" };
  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-3 py-3 transition-colors duration-[120ms] ease-out hover:bg-subtle"
    >
      <TruckLogo truck={truck} className="size-12 text-sm" sizes="48px" />
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-bold">{truckName(truck, locale)}</span>
        <span className="block text-sm text-muted">
          <Isolate>{formatDay(order.service_date, locale)}</Isolate> · <Isolate>{formatSlot(order.slot_start, locale)}</Isolate> ·{" "}
          <Isolate>{order.ticket_ref}</Isolate>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusChip status={order.status} />
        <Money amount={order.total_kwd} locale={locale} className="text-sm font-semibold" />
      </span>
      <ArrowForward className="size-4 text-muted" />
    </Link>
  );
}
