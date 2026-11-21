"use client";

import Image from "next/image";
import { useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { ParkLineArt } from "@/components/line-art";
import { CheckIcon, EyeIcon, LockIcon, MailIcon, primaryButton, TruckIcon, UserIcon } from "@/components/ui";
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
  const { t } = useLocale();
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

  const [showPassword, setShowPassword] = useState(false);
  const input =
    "block min-h-12 w-full rounded-control border border-outline bg-snowy-white px-3 text-base text-ink placeholder:text-muted";
  const label = "flex items-center gap-2 text-base font-bold";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 md:px-6">
      {/* The complete logo, once. It carries the QAFLA wordmark, so no second name sits beside it. */}
      <div className="flex items-center justify-between gap-3 pt-3">
        <Image src="/brand/qafla-logo.png" alt="" width={1254} height={1254} sizes="80px" className="size-20" preload />
        <LanguageSwitch />
      </div>

      {/* The black banner names the screen. Its line art is decoration. */}
      <div className="relative mt-2 flex min-h-28 items-center overflow-hidden rounded-poster bg-ink px-5 py-4 text-snowy-white">
        <ParkLineArt className="pointer-events-none absolute end-1 bottom-0 h-[4.5rem] w-auto text-snowy-white/45 sm:h-24" />
        <h1 className="relative max-w-[58%] text-[1.75rem] leading-tight font-extrabold text-balance">
          {mode === "sign-in" ? t.signIn : t.createAccount}
          <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-yellow-punk" />
        </h1>
      </div>

      {mode === "sign-in" && <p className="mt-4 text-muted">{t.signInFor}</p>}

      <form onSubmit={submit} className="mt-4 space-y-4">
        {mode === "sign-up" && (
          <fieldset>
            <legend className="text-lg font-extrabold">{t.accountType}</legend>
            <div className="mt-2 grid gap-2">
              {(["customer", "vendor"] as const).map((option) => {
                const chosen = role === option;
                const Icon = option === "customer" ? UserIcon : TruckIcon;
                return (
                  // Chosen: a Yellow Punk tint, an ink edge and a filled check. Not chosen: an empty ring.
                  <label
                    key={option}
                    className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-panel border px-3 py-2.5 transition-colors duration-[120ms] ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                      chosen ? "border-ink bg-yellow-punk/25" : "border-outline bg-snowy-white hover:border-ink"
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
                    <Icon className="size-7" />
                    <span className="min-w-0 flex-1 border-s border-divider ps-3">
                      <span className="block text-lg leading-snug font-extrabold">{t.signupRole[option].name}</span>
                      <span className="block text-sm text-muted">{t.signupRole[option].help}</span>
                    </span>
                    <span
                      aria-hidden
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                        chosen ? "border-ink bg-ink text-yellow-punk" : "border-outline"
                      }`}
                    >
                      {chosen && <CheckIcon className="size-4" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {mode === "sign-up" && (
          <div>
            <label htmlFor="signin-name" className={label}>
              <UserIcon className="size-5" />
              {t.name}
            </label>
            <input id="signin-name" name="name" type="text" autoComplete="name" className={`${input} mt-1.5`} />
          </div>
        )}
        <div>
          <label htmlFor="signin-email" className={label}>
            <MailIcon className="size-5" />
            {t.email}
          </label>
          <input id="signin-email" name="email" type="email" required autoComplete="email" placeholder="customer@example.com" dir="ltr" className={`${input} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="signin-password" className={label}>
            <LockIcon className="size-5 shrink-0" />
            {t.password}
          </label>
          {/* The field and its show/hide button share one outlined box. */}
          <div className="relative mt-1.5">
            <input
              id="signin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={mode === "sign-up" ? 8 : undefined}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
              dir="ltr"
              className={`${input} pe-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((was) => !was)}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
              aria-pressed={showPassword}
              className="absolute inset-y-0 end-0 inline-flex w-12 items-center justify-center rounded-control text-ink"
            >
              <EyeIcon className="size-5" off={showPassword} />
            </button>
          </div>
          {mode === "sign-up" && (
            <p id="password-hint" className="mt-1 text-sm text-muted">
              {t.passwordHint}
            </p>
          )}
        </div>

        {problem && (
          <p role="alert" className="rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
            {t[problem]}
          </p>
        )}

        <button type="submit" disabled={busy} aria-busy={busy} className={`${primaryButton} min-h-14! text-lg!`}>
          <span aria-live="polite">{busy ? t.working : mode === "sign-in" ? t.signIn : t.createAccount}</span>
        </button>
      </form>

      {/* The secondary action: a sentence with its link, as one 44 px target. */}
      <p className="mt-3 text-center">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setProblem(null);
          }}
          className="inline-flex min-h-11 items-center px-2 font-bold underline underline-offset-4"
        >
          {mode === "sign-in" ? t.newHere : t.haveAccount} {mode === "sign-in" ? t.createAnAccount : t.signIn}
        </button>
      </p>
      {mode === "sign-up" && <p className="mt-1 text-center text-sm text-muted">{t.staffHint}</p>}
    </main>
  );
}
