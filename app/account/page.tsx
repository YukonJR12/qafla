"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ParkLineArt } from "@/components/line-art";
import { ChevronForward, EditIcon, GlobeIcon, HelpIcon, primaryButton, secondaryButton, SignOutIcon, UserIcon } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { saveMyName } from "@/lib/data";
import { LOCALE_COOKIE, truckName, type Locale } from "@/lib/i18n";
import { initials } from "@/lib/initials";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";

const NAME_MAX = 60;

// Account: who is signed in on this device, in which role, and four things
// they can do here. The same screen serves customers, vendors and the manager.
//
// Everything on the card comes from the signed-in account: the name and
// email as saved, the initials worked out from them, the role from the
// database profile. Every row does something real:
//   - Personal details / Edit profile: change the name on the card. The
//     database changes that one field on the caller's own profile
//     (`set_my_name`); the email is the sign-in and is shown, not edited.
//   - Language: English or Arabic, kept in a cookie like the switch elsewhere.
//   - Help: three short answers about how pickup works in this app.
//   - Sign out: asks first, then ends the session in this browser only.
// There is no Notifications row, because the app sends none.
export default function AccountPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const { account, signOut, nameSaved } = useAccount();
  const id = useId();
  const details = useRef<HTMLDialogElement>(null);
  const language = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const leave = useRef<HTMLDialogElement>(null);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<"long" | "failed" | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (account.status !== "signed-in") return null; // the launch gate is already showing something else

  function openDetails() {
    if (account.status !== "signed-in") return;
    setDraft(account.name ?? "");
    setProblem(null);
    details.current?.showModal();
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (Array.from(draft.trim()).length > NAME_MAX) return setProblem("long");
    setSaving(true);
    setProblem(null);
    try {
      // The database tidies the name and answers with what it saved.
      const saved = await saveMyName(supabaseBrowser(), draft);
      nameSaved(saved);
      setSavedNote(true);
      details.current?.close();
    } catch (error) {
      setProblem(error instanceof Error && error.message === "name_too_long" ? "long" : "failed");
    } finally {
      setSaving(false);
    }
  }

  function choose(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    language.current?.close();
    router.refresh();
  }

  const row =
    "flex min-h-14 w-full items-center gap-3 py-3 text-start font-bold transition-colors duration-[120ms] ease-out hover:bg-subtle";
  const sheet = "m-auto w-[calc(100%-2rem)] max-w-sm rounded-poster border border-divider bg-snowy-white p-5 text-ink backdrop:bg-ink/50";
  const choice = (on: boolean) =>
    `flex min-h-12 w-full items-center justify-between gap-3 rounded-control border px-3 text-start font-bold ${
      on ? "border-ink bg-yellow-punk/25" : "border-divider hover:border-ink"
    }`;

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-10 md:px-6">
        <h1 className="text-[2.1rem] leading-tight font-extrabold tracking-tight">{t.accountTitle}</h1>

        {/* The profile card: initials on Yellow Punk, then the name, email and role as saved. */}
        <section aria-label={t.signedInAs(account.email)} className="relative mt-4 min-h-[190px] overflow-hidden rounded-poster bg-ink p-5 text-snowy-white">
          <ParkLineArt className="pointer-events-none absolute end-3 top-[14%] h-[62%] w-auto text-snowy-white/40" />
          <div className="relative flex items-center justify-between gap-3">
            <span aria-hidden className="flex size-[58px] items-center justify-center rounded-full bg-yellow-punk text-[1.7rem] font-black text-ink" dir="ltr">
              {initials(account.name, account.email)}
            </span>
            <button
              type="button"
              onClick={openDetails}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-snowy-white/70 px-3.5 text-sm font-semibold transition-colors duration-[120ms] ease-out hover:bg-snowy-white/10"
            >
              <EditIcon className="size-4" />
              {t.editProfile}
            </button>
          </div>
          <p className="relative mt-6 text-[1.65rem] leading-tight font-extrabold tracking-tight wrap-anywhere">{account.name ?? t.roleName[account.role]}</p>
          <p className="relative text-start wrap-anywhere" dir="ltr">
            {account.email}
          </p>
          <p className="relative mt-2 text-sm">
            {t.roleLabel} <span className="font-bold">{t.roleName[account.role]}</span>
            {account.truck && ` · ${truckName(account.truck, locale)}`}
          </p>
        </section>
        <p role="status" className="mt-2 min-h-5 text-sm font-semibold">
          {savedNote && t.nameSaved}
        </p>

        {/* Grouped rows. Each one opens something that works. */}
        <ul className="mt-2 divide-y divide-divider rounded-panel border border-divider px-3">
          <li>
            <button type="button" onClick={openDetails} className={row}>
              <UserIcon className="size-[21px]" />
              <span className="min-w-0 flex-1">{t.personalDetails}</span>
              <ChevronForward className="size-5" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => language.current?.showModal()} className={row}>
              <GlobeIcon className="size-[21px]" />
              <span className="min-w-0 flex-1">{t.language}</span>
              <span className="font-normal">{t.thisLanguage}</span>
              <ChevronForward className="size-5" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => help.current?.showModal()} className={row}>
              <HelpIcon className="size-[21px]" />
              <span className="min-w-0 flex-1">{t.help}</span>
              <ChevronForward className="size-5" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => leave.current?.showModal()} className={`${row} text-danger`}>
              <SignOutIcon className="size-[21px]" />
              <span className="min-w-0 flex-1">{t.signOut}</span>
              <ChevronForward className="size-5" />
            </button>
          </li>
        </ul>
      </main>

      {/* Personal details: the name can be changed; the email is the sign-in and is only shown. */}
      <dialog ref={details} aria-labelledby={`${id}-details`} className={sheet}>
        <form onSubmit={saveName}>
          <h2 id={`${id}-details`} className="text-[1.44rem] font-extrabold tracking-tight">
            {t.personalDetails}
          </h2>
          <label htmlFor={`${id}-name`} className="mt-4 block text-sm font-bold">
            {t.nameOnly}
          </label>
          <input
            id={`${id}-name`}
            type="text"
            dir="auto"
            autoComplete="name"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem(null);
            }}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${id}-name-help`}
            className={`mt-1 block min-h-12 w-full rounded-control border bg-white px-3 text-base ${problem ? "border-error" : "border-outline"}`}
          />
          <p id={`${id}-name-help`} className="mt-1 text-sm">
            {problem ? (
              <span className="font-semibold text-error">{problem === "long" ? t.nameTooLong : t.saveCopyFailed}</span>
            ) : (
              <span className="text-muted">{t.nameHelp}</span>
            )}
          </p>
          <p className="mt-4 text-sm font-bold">{t.email}</p>
          <p className="text-start wrap-anywhere" dir="ltr">
            {account.email}
          </p>
          <p className="mt-1 text-sm text-muted">{t.emailFixed}</p>
          <div className="mt-5 space-y-2">
            <button type="submit" disabled={saving} aria-busy={saving} className={primaryButton}>
              <span aria-live="polite">{saving ? t.saving : t.saveChanges}</span>
            </button>
            <button type="button" className={secondaryButton} onClick={() => details.current?.close()}>
              {t.closeDialog}
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={language} aria-labelledby={`${id}-language`} className={sheet}>
        <h2 id={`${id}-language`} className="text-[1.44rem] font-extrabold tracking-tight">
          {t.language}
        </h2>
        <div className="mt-4 space-y-2">
          <button type="button" lang="en" onClick={() => choose("en")} aria-pressed={locale === "en"} className={`${choice(locale === "en")} font-sans`}>
            English
          </button>
          <button type="button" lang="ar" onClick={() => choose("ar")} aria-pressed={locale === "ar"} className={`${choice(locale === "ar")} font-arabic`}>
            العربية
          </button>
        </div>
        <button type="button" className={`${secondaryButton} mt-4`} onClick={() => language.current?.close()}>
          {t.closeDialog}
        </button>
      </dialog>

      <dialog ref={help} aria-labelledby={`${id}-help`} className={sheet}>
        <h2 id={`${id}-help`} className="text-[1.44rem] font-extrabold tracking-tight">
          {t.help}
        </h2>
        <dl className="mt-3 space-y-3">
          {t.helpAnswers.map(([question, answer]) => (
            <div key={question}>
              <dt className="font-bold">{question}</dt>
              <dd className="text-muted">{answer}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className={`${primaryButton} mt-5`} onClick={() => help.current?.close()}>
          {t.closeDialog}
        </button>
      </dialog>

      <dialog ref={leave} aria-labelledby={`${id}-leave`} className={sheet}>
        <h2 id={`${id}-leave`} className="text-[1.44rem] font-extrabold tracking-tight">
          {t.signOutQuestion}
        </h2>
        {account.role === "customer" && <p className="mt-2 text-muted">{t.signOutNote}</p>}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={leaving}
            aria-busy={leaving}
            className={primaryButton}
            onClick={() => {
              setLeaving(true);
              signOut().finally(() => setLeaving(false));
            }}
          >
            <span aria-live="polite">{leaving ? t.signingOut : t.signOut}</span>
          </button>
          <button type="button" className={secondaryButton} onClick={() => leave.current?.close()}>
            {t.staySignedIn}
          </button>
        </div>
      </dialog>
    </div>
  );
}
