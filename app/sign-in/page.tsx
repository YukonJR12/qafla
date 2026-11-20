"use client";

import Image from "next/image";
import { useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { primaryButton } from "@/components/ui";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";
type AuthProblem = "invalidLogin" | "emailTaken" | "weakPassword" | "confirmEmail" | "authError";

// The one sign-in screen, in English or Arabic, for customers, vendors and
// the park manager alike.
//
// This page never decides where to go next. Once Supabase confirms the
// sign-in, the launch gate reads the account's profile from the database
// and opens the right workspace, or the page the visitor first asked for
// if their role may open it (see lib/routes.ts).
//
// Only customer accounts can be created here. Vendor and manager accounts
// are set up by the park.
export default function SignInPage() {
  const { t, locale } = useLocale();
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
    // Signed in. The button stays busy until the launch gate takes over.
  }

  const input =
    "mt-1 block min-h-12 w-full rounded-control border border-outline bg-snowy-white px-3 text-base text-ink placeholder:text-muted";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 md:px-6">
      <div className="flex justify-end pt-3">
        <LanguageSwitch />
      </div>

      <div className="flex flex-1 flex-col justify-center py-4">
        <div className="logo-enter flex flex-col items-center text-center">
          <Image
            src="/brand/qafla-logo.png"
            alt=""
            width={1254}
            height={1254}
            sizes="(min-width: 640px) 208px, 160px"
            className="h-auto w-40 max-w-full sm:w-52"
            preload
          />
          {locale === "en" && (
            <p lang="ar" dir="rtl" aria-hidden className="font-arabic text-2xl leading-[1.35] font-black">
              قافلة
            </p>
          )}
        </div>

        <h1 className="mt-5 text-2xl leading-tight font-extrabold text-balance">
          {mode === "sign-in" ? t.welcomeBack : t.signUpTitle}
        </h1>
        <p className="mt-1 text-muted">{mode === "sign-in" ? t.signInLead : t.signUpLead}</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
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
            <span aria-live="polite">{busy ? t.working : mode === "sign-in" ? t.signIn : t.createAccount}</span>
          </button>
        </form>

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
        {mode === "sign-up" && <p className="mt-1 text-center text-sm text-muted">{t.staffHint}</p>}
      </div>
    </main>
  );
}
