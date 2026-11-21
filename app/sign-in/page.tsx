"use client";

import Image from "next/image";
import { useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { CheckIcon, primaryButton, secondaryButton } from "@/components/ui";
import { useLocale } from "@/lib/locale";
import { signupRole, type SignupRole } from "@/lib/routes";
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
// "Create account" offers two kinds of account: customer or truck vendor.
// The choice is sent with the signup, and the database's own signup trigger
// saves the role (it accepts 'customer' or 'vendor' and nothing else). The
// app then routes from that saved profile, never from what was chosen here.
// A new vendor has no truck until the park assigns one, so they land on the
// "no truck assigned" screen. The manager's account is only ever set in the
// database.
export default function SignInPage() {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [role, setRole] = useState<SignupRole>("customer");
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
        : // The database's signup trigger reads this and saves the profile's role.
          await auth.signUp({ email, password, options: { data: { role: signupRole(role), display_name: displayName } } });

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
        {/* The logo already made its entrance on the launch screen, so here it is simply present. */}
        <div className="flex flex-col items-center text-center">
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
            <fieldset>
              <legend className="text-sm font-semibold">{t.accountType}</legend>
              <div className="mt-1 grid gap-2">
                {(["customer", "vendor"] as const).map((option) => {
                  const chosen = role === option;
                  return (
                    // Selected: ink fill, light text and a check, like a chosen pickup time.
                    <label
                      key={option}
                      className={`relative flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-3 py-2.5 transition-colors duration-[120ms] ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                        chosen ? "border-ink bg-ink text-snowy-white" : "border-outline bg-snowy-white text-ink hover:border-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option}
                        checked={chosen}
                        onChange={() => setRole(option)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{t.signupRole[option].name}</span>
                        <span className={`block text-sm ${chosen ? "" : "text-muted"}`}>{t.signupRole[option].help}</span>
                      </span>
                      {chosen && <CheckIcon className="size-5" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
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
          className={`${secondaryButton} mt-3`}
        >
          {mode === "sign-in" ? t.toSignUp : t.toSignIn}
        </button>
        {mode === "sign-up" && <p className="mt-2 text-center text-sm text-muted">{t.staffHint}</p>}
      </div>
    </main>
  );
}
