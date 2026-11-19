"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CheckIcon, Isolate, Money, primaryButton, secondaryButton } from "@/components/ui";
import { fetchOrder, type Order } from "@/lib/data";
import { itemName, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { formatSlot } from "@/lib/time";
import { useSession } from "@/lib/use-session";

// The confirmed order ticket. Everything on it is read back from the
// database by the order's ID, so refreshing shows the same saved order and
// never places another one.
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLocale();
  const { loading: sessionLoading, session } = useSession();
  const [state, setState] = useState<{ loaded: boolean; order: Order | null }>({ loaded: false, order: null });
  const [checking, setChecking] = useState(false);

  const load = useCallback(
    () =>
      fetchOrder(supabaseBrowser(), id)
        .then((order) => setState({ loaded: true, order }))
        .catch(() => setState({ loaded: true, order: null })),
    [id],
  );

  useEffect(() => {
    if (sessionLoading) return;
    load();
  }, [sessionLoading, session?.user.id, load]);

  const { loaded, order } = state;

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.orderPlaced} backHref="/explore" backLabel={t.backToTrucksFromTicket} />

      <main className="mx-auto max-w-xl px-4 pt-4 pb-10 md:px-6">
        {!loaded ? (
          <p className="min-h-96 text-muted" aria-live="polite">
            {t.loading}
          </p>
        ) : !order ? (
          <div className="pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.orderNotFound}</h2>
            <p className="mt-2 text-muted">{t.orderNotFoundBody}</p>
            <Link href={`/sign-in?next=/orders/${id}`} className={`${primaryButton} mt-6`}>
              {t.signIn}
            </Link>
          </div>
        ) : (
          <>
            {/* A persistent Yellow Punk notice once the truck marks the order ready. */}
            {order.status === "ready" && (
              <p role="status" className="mb-4 flex items-center gap-2.5 rounded-control border border-ink bg-yellow-punk p-3 font-bold">
                <CheckIcon className="size-6" />
                <span>
                  {t.statusHelp.ready} · {truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)}
                </span>
              </p>
            )}

            <article className="rounded-panel border border-ink p-6">
              {/* Lead with the confirmed time and the truck. */}
              <p className="text-sm font-semibold text-muted">{t.pickUpAt}</p>
              <p className="text-5xl leading-none font-extrabold tracking-tight">
                <Isolate>{formatSlot(order.slot_start, locale)}</Isolate>
              </p>
              <p className="mt-2 text-2xl leading-tight font-extrabold">
                {truckName(order.trucks ?? { id: order.truck_id, name: "" }, locale)}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-dashed border-outline pt-4">
                <dt className="text-sm font-semibold text-muted">{t.orderRef}</dt>
                <dt className="text-sm font-semibold text-muted">{t.status}</dt>
                <dd className="text-lg font-bold">
                  <Isolate>{order.ticket_ref}</Isolate>
                </dd>
                <dd className="text-lg font-bold" aria-live="polite">
                  {t.statusName[order.status] ?? order.status}
                </dd>
              </dl>
              <p className="mt-1 text-sm text-muted">
                {order.status === "rejected" && order.rejection_reason
                  ? `${t.statusHelp.rejected} ${order.rejection_reason}`
                  : order.status !== "ready" && t.statusHelp[order.status]}
              </p>

              <ul className="mt-4 space-y-1.5 border-t border-divider pt-4">
                {order.order_items.map((line) => (
                  <li key={line.item_id} className="flex items-baseline justify-between gap-3">
                    <span>
                      <Isolate className="font-bold">{line.quantity} ×</Isolate>{" "}
                      {itemName({ id: line.item_id, name: line.item_name }, locale)}
                    </span>
                    <Money amount={Number(line.unit_price_kwd) * line.quantity} locale={locale} className="font-semibold" />
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-divider pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">{t.totalAtCounter}</p>
                  {/* The total the server saved with the order. */}
                  <Money amount={order.total_kwd} locale={locale} className="text-2xl font-extrabold" />
                </div>
                <p className="mt-1 text-sm text-muted">{t.paymentLine}</p>
              </div>
            </article>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={checking}
                aria-busy={checking}
                className={secondaryButton}
                onClick={async () => {
                  setChecking(true);
                  await load();
                  setChecking(false);
                }}
              >
                {checking ? t.loading : t.checkStatus}
              </button>
              <Link href="/explore" className={primaryButton}>
                {t.backToTrucksFromTicket}
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
