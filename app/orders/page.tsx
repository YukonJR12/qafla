"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadError } from "@/components/cart-states";
import { LanguageSwitch } from "@/components/language-switch";
import { TicketCard } from "@/components/ticket-card";
import { TruckLogo } from "@/components/truck-logo";
import { ArrowForward, CheckIcon, Isolate, Money, primaryButton, XIcon } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchMyOrders, type MyOrder } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { groupByDate, splitOrders } from "@/lib/orders";
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
  const { locale, t } = useLocale();
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
      <header>
        <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 pt-5 md:px-6">
          <h1 className="min-w-0 flex-1 text-[2.1rem] leading-tight font-extrabold tracking-tight">{t.ordersTitle}</h1>
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
              <h2 id="active-title" className="text-xl font-extrabold">
                {active.length === 1 ? t.activeOrder : t.activeOrders}
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
                <h2 id="past-title" className="text-xl font-extrabold">
                  {t.pastOrders}
                </h2>
                {/* One group per service date, newest first, each under its date. */}
                {groupByDate(past).map((group) => (
                  <div key={group.date} className="mt-3">
                    <h3 className="inline-block rounded-full bg-subtle px-3 py-1.5 text-sm font-semibold">
                      <Isolate>{formatDay(group.date, locale, "long")}</Isolate>
                    </h3>
                    <ul className="mt-1 divide-y divide-divider border-b border-divider lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0 lg:border-b-0">
                      {group.orders.map((order) => (
                        <li key={order.id} className="lg:border-b lg:border-divider">
                          <PastOrder order={order} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/** An order the truck is still working on: the black ticket, ending in the way back to the live ticket. */
function ActiveOrder({ order }: { order: MyOrder }) {
  const { locale, t } = useLocale();
  const truck = order.trucks ?? { id: order.truck_id, name: "" };
  return (
    <Link href={`/orders/${order.id}`} className="block rounded-poster">
      <TicketCard truck={truck} slot={order.slot_start} status={order.status}>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-bold">
          <Isolate>{order.ticket_ref}</Isolate>
          <Money amount={order.total_kwd} locale={locale} />
        </p>
        {/* The whole card is the link; this is its visible call to action. */}
        <span className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-control bg-snowy-white px-4 text-base font-bold text-ink">
          {t.openLiveTicket}
          <ArrowForward className="size-5" />
        </span>
      </TicketCard>
    </Link>
  );
}

/** A finished, cancelled or older order: one compact row. Its date is the heading of its group. */
function PastOrder({ order }: { order: MyOrder }) {
  const { locale, t } = useLocale();
  const truck = order.trucks ?? { id: order.truck_id, name: "" };
  const over = order.status === "cancelled" || order.status === "rejected";
  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-3 py-3 transition-colors duration-[120ms] ease-out hover:bg-subtle"
    >
      <TruckLogo truck={truck} className="size-11 border-0! text-sm" sizes="44px" />
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-bold">{truckName(truck, locale)}</span>
        <span className="block text-sm text-muted">
          <Isolate>{formatSlot(order.slot_start, locale)}</Isolate> · <Isolate>{order.ticket_ref}</Isolate>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <Money amount={order.total_kwd} locale={locale} className="font-bold" />
        {/* The final state in words, with a mark, so it does not rely on colour. */}
        <span className={`inline-flex items-center gap-1 text-sm ${over ? "text-danger" : "text-muted"}`}>
          {over ? <XIcon className="size-3.5" /> : order.status === "collected" ? <CheckIcon className="size-3.5" /> : null}
          {t.statusName[order.status] ?? order.status}
        </span>
      </span>
    </Link>
  );
}
