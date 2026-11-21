"use client";

import { useEffect, useId, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { LoadError } from "@/components/cart-states";
import { CheckIcon, primaryButton, secondaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchMyTruck, saveTruckDetails, type Truck } from "@/lib/data";
import { truckBlurb, truckCuisine, truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { supabaseBrowser } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { BLURB_MAX, checkDetails, CUISINE_MAX, NAME_MAX, type TruckDetails } from "@/lib/vendor-edits";

// The vendor's truck details: the name, cuisine and one-line description
// that introduce the truck to customers.
//
// Two things are kept apart, as on the dish editor:
//   - what customers see now: the saved truck, read from the database;
//   - the vendor's draft: the three fields below, which exist only here.
// Only "Save details" changes what customers see. The database decides
// whether it may: row-level security lets a vendor change their own truck's
// row and nobody else's, and check constraints keep each field short.
export default function TruckDetailsPage() {
  const { locale, t } = useLocale();
  const { session } = useSession();
  const { truckSaved } = useAccount();
  const userId = session?.user.id ?? null;
  const formId = useId();

  const [loaded, setLoaded] = useState<{ userId: string; truck: Truck | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<TruckDetails>({ name: "", cuisine: "", blurb: "" });
  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchMyTruck(supabaseBrowser(), userId).then(
      (truck) => {
        if (!current) return;
        setLoaded({ userId, truck, failed: false });
        if (truck) setDraft({ name: truck.name, cuisine: truck.cuisine, blurb: truck.blurb });
      },
      () => current && setLoaded({ userId, truck: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [userId, attempt]);
  const state = loaded && loaded.userId === userId ? loaded : null;
  const saved = state?.truck ?? null;

  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false); // problems are shown once Save has been pressed
  const [note, setNote] = useState<"saved" | "failed" | "not_yours" | null>(null);

  const { details, problems } = checkDetails(draft);
  const dirty = saved !== null && (details.name !== saved.name || details.cuisine !== saved.cuisine || details.blurb !== saved.blurb);
  const valid = Object.keys(problems).length === 0;

  function type(field: keyof TruckDetails, value: string) {
    setDraft((was) => ({ ...was, [field]: value }));
    setNote(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || saving || !dirty) return;
    setTried(true);
    if (!valid) return;
    setSaving(true);
    setNote(null);
    try {
      const truck = await saveTruckDetails(supabaseBrowser(), saved.id, details);
      setLoaded({ userId: userId!, truck, failed: false });
      setDraft({ name: truck.name, cuisine: truck.cuisine, blurb: truck.blurb });
      setTried(false);
      setNote("saved");
      truckSaved(truck); // the other vendor screens show the new name
    } catch (error) {
      setNote(error instanceof Error && error.message === "not_your_truck" ? "not_yours" : "failed");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!saved) return;
    setDraft({ name: saved.name, cuisine: saved.cuisine, blurb: saved.blurb });
    setTried(false);
    setNote(null);
  }

  const fields: { key: keyof TruckDetails; label: string; max: number; hint?: string }[] = [
    { key: "name", label: t.truckNameLabel, max: NAME_MAX },
    { key: "cuisine", label: t.cuisineLabel, max: CUISINE_MAX },
    { key: "blurb", label: t.blurbLabel, max: BLURB_MAX, hint: t.blurbHint },
  ];

  return (
    <div className="min-h-dvh">
      <AppHeader title={t.truckDetails} backHref="/vendor" backLabel={t.backToBoard} />

      <main className="mx-auto max-w-[640px] px-4 pt-4 pb-10 md:px-6">
        {!state ? (
          <div role="status" aria-label={t.loading} className="space-y-3">
            <div className="h-28 rounded-panel bg-subtle" />
            <div className="h-64 rounded-panel bg-subtle" />
          </div>
        ) : state.failed ? (
          <LoadError title={t.boardLoadErrorTitle} body={t.boardLoadErrorBody} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !saved ? (
          <div className="pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.notVendorTitle}</h2>
            <p className="mt-2 text-muted">{t.notVendorBody}</p>
          </div>
        ) : (
          <>
            <p className="text-muted">{t.truckDetailsLead}</p>

            {/* What customers see now: the saved truck, never the draft. */}
            <section aria-labelledby={`${formId}-live`} className="mt-4 rounded-panel border border-ink p-4">
              <h2 id={`${formId}-live`} className="text-sm font-semibold text-muted">
                {t.customersSee}
              </h2>
              <p className="mt-2 inline-block rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white">
                {truckCuisine(saved, locale)}
              </p>
              <p className="mt-2 text-2xl leading-tight font-extrabold text-balance">{truckName(saved, locale)}</p>
              <p className={saved.blurb ? "mt-1" : "mt-1 text-muted"}>{saved.blurb ? truckBlurb(saved, locale) : t.noDescriptionLine}</p>
            </section>

            <form onSubmit={save} noValidate className="mt-6 space-y-4">
              {fields.map(({ key, label, max, hint }) => {
                const problem = tried ? problems[key] : undefined;
                const left = max - Array.from(draft[key]).length;
                const id = `${formId}-${key}`;
                return (
                  <div key={key}>
                    <label htmlFor={id} className="block text-sm font-semibold">
                      {label}
                    </label>
                    <input
                      id={id}
                      type="text"
                      dir="auto"
                      autoComplete="off"
                      value={draft[key]}
                      onChange={(event) => type(key, event.target.value)}
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={`${id}-help`}
                      className={`mt-1 block min-h-12 w-full rounded-control border bg-snowy-white px-3 py-2 text-base text-ink ${
                        problem ? "border-error" : "border-outline"
                      }`}
                    />
                    <p id={`${id}-help`} className="mt-1 text-sm">
                      {problem ? (
                        <span className="font-semibold text-error">{t.detailProblem[problem]}</span>
                      ) : (
                        <span className="text-muted tabular-nums">
                          {hint && `${hint} `}
                          {t.descriptionLeft(left)}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}

              <p className="rounded-control bg-subtle p-3 text-sm">{t.detailsLanguageNote}</p>

              <div role="status">
                {note === "saved" && (
                  <p className="reveal-up flex items-start gap-2 rounded-control bg-ink p-3 font-semibold text-snowy-white">
                    <CheckIcon className="mt-0.5 size-5" />
                    {t.detailsSaved}
                  </p>
                )}
              </div>
              {(note === "failed" || note === "not_yours") && (
                <p role="alert" className="rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
                  {note === "not_yours" ? t.truckNotYours : t.saveCopyFailed}
                </p>
              )}

              <div className="space-y-2">
                <button type="submit" disabled={!dirty || saving} aria-busy={saving} className={primaryButton}>
                  <span aria-live="polite">{saving ? t.saving : t.saveDetails}</span>
                </button>
                <p className="text-center text-sm text-muted">{dirty ? t.unsavedChanges : t.noChanges}</p>
                <button
                  type="button"
                  onClick={discard}
                  disabled={!dirty || saving}
                  className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {t.discardChanges}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
