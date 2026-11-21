"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { activeNav, homeFor, navFor, type NavItem, type Role } from "@/lib/routes";
import { BagIcon, ClockIcon, FlameIcon, GridIcon, ListIcon, SlidersIcon, StoreIcon, TicketIcon, UserIcon } from "./ui";

const ICONS: Record<NavItem["key"], (props: { className?: string }) => React.ReactNode> = {
  explore: StoreIcon,
  orders: TicketIcon,
  account: UserIcon,
  kitchen: FlameIcon,
  menu: ListIcon,
  capacity: SlidersIcon,
  overview: GridIcon,
  slot: ClockIcon,
};

/** Cart and checkout are one focused task with their own Back button. */
export function hidesBottomBar(path: string): boolean {
  return path === "/cart" || path === "/checkout";
}

/**
 * The phone's bottom bar: three destinations for the signed-in role.
 * Customers get Explore, Orders and Account; vendors Kitchen, Menu, Capacity
 * and Account; the manager Overview, Slot details and Account.
 *
 * It sits on an opaque surface above the phone's safe area. The current
 * destination has a Red Orange icon, a bold ink label with a Red Orange
 * line under it, and aria-current, so it does not rely on colour alone.
 */
export function BottomBar({ role }: { role: Role }) {
  const { t } = useLocale();
  const path = usePathname();
  const search = useSearchParams().toString();
  const active = activeNav(role, path, search);
  if (hidesBottomBar(path)) return null;

  return (
    <nav
      aria-label={t.navLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-snowy-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {navFor(role).map((item) => {
          const Icon = ICONS[item.key];
          const here = item.key === active;
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={here ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 px-1 pb-1.5 text-xs leading-tight transition-colors duration-[120ms] ease-out ${
                  here ? "font-extrabold text-ink" : "font-semibold text-muted hover:text-ink"
                }`}
              >
                <Icon className={`size-6 ${here ? "text-red-orange" : ""}`} />
                <span className="max-w-full truncate">{t.nav[item.key]}</span>
                {here && <span aria-hidden className="absolute inset-x-5 bottom-1.5 h-[3px] rounded-full bg-red-orange" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * From 768 px the same destinations move to a bar across the top, with the
 * Qafla logo as the way home. Nothing is pinned to the bottom any more, so
 * the whole width and height go to content.
 */
export function TopBar({ role }: { role: Role }) {
  const { t } = useLocale();
  const path = usePathname();
  const search = useSearchParams().toString();
  const active = activeNav(role, path, search);
  const { count } = useCart();

  return (
    <nav aria-label={t.navLabel} className="hidden border-b border-divider bg-snowy-white md:block">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-6 px-6">
        <Link href={homeFor(role)} aria-label={t.homeLabel} className="shrink-0 rounded-control">
          <Image src="/brand/qafla-logo.png" alt="" width={1254} height={1254} sizes="72px" className="size-[72px]" />
        </Link>
        <ul className="flex items-center gap-1">
          {navFor(role).map((item) => {
            const Icon = ICONS[item.key];
            const here = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={here ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 text-base transition-colors duration-[120ms] ease-out ${
                    here ? "bg-ink font-bold text-snowy-white" : "font-semibold text-ink hover:bg-subtle"
                  }`}
                >
                  <Icon className="size-5" />
                  {t.nav[item.key]}
                </Link>
              </li>
            );
          })}
        </ul>
        {role === "customer" && (
          <Link
            href="/cart"
            aria-label={t.cartWithCount(count)}
            aria-current={path === "/cart" ? "page" : undefined}
            className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-control border border-outline px-3.5 font-bold transition-colors duration-[120ms] ease-out hover:border-ink hover:bg-subtle"
          >
            <BagIcon className="size-5" />
            {t.cart}
            {count > 0 && (
              <span
                key={count}
                className="bump inline-flex size-7 items-center justify-center rounded-full border border-ink bg-yellow-punk text-sm font-extrabold tabular-nums"
              >
                {count}
              </span>
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}
