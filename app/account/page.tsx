"use client";

import { useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { ParkLineArt } from "@/components/line-art";
import { TruckLogo } from "@/components/truck-logo";
import { ChevronForward, GlobeIcon, SignOutIcon, StoreIcon, UserIcon } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { truckName } from "@/lib/i18n";
import { initials } from "@/lib/initials";
import { useLocale } from "@/lib/locale";

// Account: who is signed in on this device, in which role, the language,
// and the way out. The same screen serves customers, vendors and the manager.
//
// Everything on the card comes from the signed-in account: the name and
// email as saved, the initials worked out from them, the role from the
// database profile. There is a row here only where something works behind
// it, so there is no "Edit profile", "Notifications" or "Help".
//
// "Sign out" ends the session in this browser only. The launch gate then
// shows the sign-in screen, and whoever signs in next starts from their own
// workspace with their own cart and orders.
export default function AccountPage() {
  const { locale, t } = useLocale();
  const { account, signOut } = useAccount();
  const [leaving, setLeaving] = useState(false);

  if (account.status !== "signed-in") return null; // the launch gate is already showing something else

  const row = "flex min-h-16 items-center gap-4 px-4 py-2";
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-10 md:px-6">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t.accountTitle}</h1>

        {/* The profile card: initials on Yellow Punk, then the name and email as saved. */}
        <section aria-label={t.signedInAs(account.email)} className="relative mt-4 overflow-hidden rounded-poster bg-ink p-5 text-snowy-white">
          <ParkLineArt className="pointer-events-none absolute end-3 top-3 h-24 w-auto text-snowy-white/45" />
          <span
            aria-hidden
            className="relative flex size-20 items-center justify-center rounded-full bg-yellow-punk text-3xl font-black text-ink"
            dir="ltr"
          >
            {initials(account.name, account.email)}
          </span>
          {account.name && <p className="relative mt-4 text-2xl leading-tight font-extrabold wrap-anywhere">{account.name}</p>}
          <p className={`relative text-start wrap-anywhere ${account.name ? "mt-0.5 text-sm" : "mt-4 text-lg font-bold"}`} dir="ltr">
            {account.email}
          </p>
        </section>

        {/* Grouped rows. Each one shows a fact or does something. */}
        <ul className="mt-5 divide-y divide-divider rounded-panel border border-outline">
          <li className={row}>
            <UserIcon className="size-6" />
            <span className="min-w-0 flex-1 font-bold">{t.roleLabel}</span>
            <span className="font-semibold text-muted">{t.roleName[account.role]}</span>
          </li>
          {account.truck && (
            <li className={row}>
              <StoreIcon className="size-6" />
              <span className="min-w-0 flex-1 font-bold">{t.yourTruck}</span>
              <span className="flex items-center gap-2 font-semibold text-muted">
                {truckName(account.truck, locale)}
                <TruckLogo truck={account.truck} className="size-11 text-sm" sizes="44px" />
              </span>
            </li>
          )}
          <li className={row}>
            <GlobeIcon className="size-6" />
            <span className="min-w-0 flex-1 font-bold">{t.language}</span>
            <LanguageSwitch />
          </li>
          <li>
            <button
              type="button"
              disabled={leaving}
              aria-busy={leaving}
              className={`${row} w-full rounded-b-panel text-start font-bold transition-colors duration-[120ms] ease-out hover:bg-subtle`}
              onClick={() => {
                setLeaving(true);
                signOut().finally(() => setLeaving(false));
              }}
            >
              <SignOutIcon className="size-6 text-red-orange" />
              <span aria-live="polite" className="min-w-0 flex-1">
                {leaving ? t.signingOut : t.signOut}
              </span>
              <ChevronForward className="size-5" />
            </button>
          </li>
        </ul>
        {account.role === "customer" && <p className="mt-3 text-sm text-muted">{t.signOutNote}</p>}
      </main>
    </div>
  );
}
