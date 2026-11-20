"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, Suspense, useEffect, useState } from "react";
import { useAccount, whoIs } from "@/lib/account";
import { useLocale } from "@/lib/locale";
import { route, SIGN_IN } from "@/lib/routes";
import { BottomBar, hidesBottomBar, TopBar } from "./app-nav";
import { LanguageSwitch } from "./language-switch";
import { Splash } from "./splash";
import { primaryButton, secondaryButton } from "./ui";

/**
 * The launch gate. Every screen is rendered through it.
 *
 * 1. While the browser restores a saved session: the Qafla logo.
 * 2. Nobody signed in: straight to the one sign-in screen, remembering the
 *    page that was asked for (a pickup ticket, for example).
 * 3. Signed in: the role in the account's database profile picks the
 *    workspace. Customers get Explore, vendors the Kitchen, the manager the
 *    park overview. A page that role may not open sends them home instead.
 * 4. A vendor with no truck assigned gets a screen that says exactly that.
 *
 * The decision itself is `route()` in lib/routes.ts, which is unit-tested.
 * This component only carries it out.
 *
 * The page below is keyed by the account, so when someone else signs in on
 * the same phone every screen starts again from nothing: no list, form or
 * live connection of the previous person survives.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { account } = useAccount();
  const { t } = useLocale();
  const path = usePathname();
  const router = useRouter();

  const { view } = route(whoIs(account), path);

  useEffect(() => {
    // The address's query is only known in the browser, so the redirect is
    // worked out here. It carries the "return to" page into and out of sign-in.
    const { redirect } = route(whoIs(account), path, window.location.search);
    if (redirect) router.replace(redirect);
  }, [account, path, router]);

  if (view === "failed") return <AccountProblem />;
  if (view === "unassigned") return <UnassignedVendor />;
  if (view === "splash" || account.status === "restoring") return <Splash label={t.restoring} />;

  // The sign-in screen stands alone: no navigation until someone is signed in.
  if (account.status !== "signed-in" || path === SIGN_IN) return <>{children}</>;

  const bottomBar = !hidesBottomBar(path);
  return (
    <Fragment key={account.userId}>
      {/* The bars read the address's query (Slot details), which needs a Suspense boundary. */}
      <Suspense>
        <TopBar role={account.role} />
      </Suspense>
      {/*
        --nav-h is how much of the bottom of a phone screen the bar covers.
        Anything else pinned to the bottom (the cart bar) sits above it.
      */}
      <div
        className={
          bottomBar
            ? "pb-[calc(4rem+env(safe-area-inset-bottom))] [--nav-h:calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:[--nav-h:0px]"
            : "[--nav-h:0px]"
        }
      >
        {children}
      </div>
      <Suspense>
        <BottomBar role={account.role} />
      </Suspense>
    </Fragment>
  );
}

/** The frame the two "can't open a workspace" screens share: logo, language, a message, actions. */
function Notice({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  const { account } = useAccount();
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8 md:px-6">
      <div className="flex items-center justify-between gap-3 pt-3">
        <Image src="/brand/qafla-logo.png" alt="" width={1254} height={1254} sizes="96px" className="size-24" />
        <LanguageSwitch />
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <h1 className="text-2xl leading-tight font-extrabold text-balance">{title}</h1>
        <p className="mt-2 text-muted">{body}</p>
        {"email" in account && <p className="mt-3 text-sm break-all text-muted">{t.signedInAs(account.email)}</p>}
        <div className="mt-6 space-y-2">{children}</div>
      </div>
    </main>
  );
}

function SignOutButton() {
  const { signOut } = useAccount();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      className={secondaryButton}
      onClick={() => {
        setBusy(true);
        signOut().finally(() => setBusy(false));
      }}
    >
      {busy ? t.signingOut : t.signOut}
    </button>
  );
}

/** A vendor account that works but runs no truck. Said plainly, with a way forward. */
function UnassignedVendor() {
  const { retry } = useAccount();
  const { t } = useLocale();
  return (
    <Notice title={t.unassignedTitle} body={t.unassignedBody}>
      <button type="button" className={primaryButton} onClick={retry}>
        {t.checkAgain}
      </button>
      <SignOutButton />
    </Notice>
  );
}

/** The session is fine but the profile could not be read. Nothing is guessed. */
function AccountProblem() {
  const { retry } = useAccount();
  const { t } = useLocale();
  return (
    <Notice title={t.accountErrorTitle} body={t.accountErrorBody}>
      <button type="button" className={primaryButton} onClick={retry}>
        {t.retry}
      </button>
      <SignOutButton />
    </Notice>
  );
}
