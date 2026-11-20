"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { primaryButton } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";
type AuthProblem = "invalidLogin" | "emailTaken" | "weakPassword" | "confirmEmail" | "authError";

// Sign in or create a customer account. The cart is not touched here: it
// lives in the browser's storage and is still there when the customer returns.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

/** Only allow returning to a page inside this app. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/explore";
}

function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { t } = useLocale();
  const { count } = useCart();
  // The kitchen board sends vendors here, and the park dashboard sends the
  // manager. Neither kind of account is created on this page.
  const forManager = next.startsWith("/manager");
  const forVendor = next.startsWith("/vendor") || forManager;

  const [mode, setMode] = useState<Mode>("sign-in");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AuthProblem | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("name") ?? "").trim();

    if (mode === "sign-up" && password.length < 8) {
      setProblem("weakPassword");
      return;
    }

    setBusy(true);
    setProblem(null);
    const auth = supabaseBrowser().auth;
    const { data, error } =
      mode === "sign-in"
        ? await auth.signInWithPassword({ email, password })
        : // The database turns a new account into a 'customer' profile by itself.
          await auth.signUp({ email, password, options: { data: { role: "customer", display_name: displayName } } });

    if (error) {
      setBusy(false);
      if (error.code === "invalid_credentials") setProblem("invalidLogin");
      else if (error.code === "user_already_exists" || error.code === "email_exists") setProblem("emailTaken");
      else if (error.code === "weak_password") setProblem("weakPassword");
      else setProblem("authError");
      return;
    }
    if (!data.session) {
      // The project asks new accounts to confirm their email first.
      setBusy(false);
      setProblem("confirmEmail");
      return;
    }
    router.replace(next);
  }

  const input =
    "mt-1 block min-h-12 w-full rounded-control border border-outline bg-snowy-white px-3 text-base text-ink placeholder:text-muted";

  return (
    <div className="min-h-dvh">
      <AppHeader title={mode === "sign-in" ? t.signIn : t.createAccount} backHref={next} backLabel={t.back} />

      <main className="mx-auto max-w-xl px-4 pt-6 pb-10 md:px-6">
        <h2 className="text-2xl leading-tight font-extrabold text-balance">
          {forManager ? t.managerSignInTitle : forVendor ? t.vendorSignInTitle : mode === "sign-in" ? t.signInTitle : t.signUpTitle}
        </h2>
        {forVendor ? (
          <p className="mt-2 text-muted">{forManager ? t.managerSignInBody : t.vendorSignInBody}</p>
        ) : (
          count > 0 && <p className="mt-2 text-muted">{t.cartKept}</p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
          {mode === "sign-up" && (
            <label className="block text-sm font-semibold">
              {t.name}
              <input name="name" type="text" autoComplete="name" className={input} />
            </label>
          )}
          <label className="block text-sm font-semibold">
            {t.email}
            <input name="email" type="email" required autoComplete="email" dir="ltr" className={input} />
          </label>
          <label className="block text-sm font-semibold">
            {t.password}
            <input
              name="password"
              type="password"
              required
              minLength={mode === "sign-up" ? 8 : undefined}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
              dir="ltr"
              className={input}
            />
            {mode === "sign-up" && (
              <span id="password-hint" className="mt-1 block font-normal text-muted">
                {t.passwordHint}
              </span>
            )}
          </label>

          {problem && (
            <p role="alert" className="rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
              {t[problem]}
            </p>
          )}

          <button type="submit" disabled={busy} aria-busy={busy} className={primaryButton}>
            {busy ? t.working : mode === "sign-in" ? t.signIn : t.createAccount}
          </button>
        </form>

        {!forVendor && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setProblem(null);
            }}
            className="mt-4 min-h-11 w-full text-center font-bold underline underline-offset-4"
          >
            {mode === "sign-in" ? t.toSignUp : t.toSignIn}
          </button>
        )}
      </main>
    </div>
  );
}
