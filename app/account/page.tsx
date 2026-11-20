"use client";

import Image from "next/image";
import { useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { TruckLogo } from "@/components/truck-logo";
import { primaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

// Account: who is signed in on this device, in which role, the language,
// and the way out. The same screen serves customers, vendors and the manager.
//
// "Sign out" ends the session in this browser only. The launch gate then
// shows the sign-in screen, and whoever signs in next starts from their own
// workspace with their own cart and orders.
export default function AccountPage() {
  const { locale, t } = useLocale();
  const { account, signOut } = useAccount();
  const [leaving, setLeaving] = useState(false);

  if (account.status !== "signed-in") return null; // the launch gate is already showing something else

  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted md:hidden">{t.appName}</p>
            <h1 className="text-[1.75rem] leading-tight font-extrabold">{t.accountTitle}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-10 md:px-6">
        <div className="flex items-center gap-4">
          <Image src="/brand/qafla-logo.png" alt="" width={1254} height={1254} sizes="96px" className="size-24 shrink-0 md:hidden" />
          <div className="min-w-0">
            {account.name && <p className="text-2xl leading-tight font-extrabold wrap-anywhere">{account.name}</p>}
            <p className={`break-all ${account.name ? "text-muted" : "text-xl leading-tight font-extrabold"}`} dir="ltr">
              {account.email}
            </p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-divider border-y border-divider">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-sm font-semibold text-muted">{t.roleLabel}</dt>
            <dd className="font-bold">{t.roleName[account.role]}</dd>
          </div>
          {account.truck && (
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sm font-semibold text-muted">{t.yourTruck}</dt>
              <dd className="flex items-center gap-2 font-bold">
                {truckName(account.truck, locale)}
                <TruckLogo truck={account.truck} className="size-11 text-sm" sizes="44px" />
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm font-semibold text-muted">{t.language}</dt>
            <dd>
              <LanguageSwitch />
            </dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={leaving}
          aria-busy={leaving}
          className={`${primaryButton} mt-8`}
          onClick={() => {
            setLeaving(true);
            signOut().finally(() => setLeaving(false));
          }}
        >
          <span aria-live="polite">{leaving ? t.signingOut : t.signOut}</span>
        </button>
        {account.role === "customer" && <p className="mt-3 text-sm text-muted">{t.signOutNote}</p>}
      </main>
    </div>
  );
}
