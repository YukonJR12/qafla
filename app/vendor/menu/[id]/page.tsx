"use client";

import { useParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AllergenConfirmation } from "@/components/allergen-confirmation";
import { MorphingButton } from "@/components/morphing-button";
import { LoadError } from "@/components/cart-states";
import { CameraIcon, CheckIcon, Money, primaryButton, secondaryButton } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { fetchMenu, saveMenuCopy, setDishPrice, setDishSoldOut, type MenuItem } from "@/lib/data";
import { itemName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { ALLERGENS, MAX_DESCRIPTION, PHOTO_TYPES, tidyText, type Suggestion } from "@/lib/menu-ai";
import { requestSuggestion, shrinkPhoto, type SuggestResult } from "@/lib/suggest-client";
import { formatKwd } from "@/lib/money";
import { supabaseBrowser } from "@/lib/supabase";
import { formatKuwaitTime } from "@/lib/time";
import { parsePrice, priceText } from "@/lib/vendor-edits";

// One dish: its price, whether it is available, and its description and
// allergens. Price, availability and description are three separate fields
// with three separate saves (DESIGN.md, Menu editor), so changing one can
// never change another by accident.
//
// Three things are kept apart on this screen:
//   - what customers see now: the saved dish, read from the database;
//   - the vendor's draft: the two fields below, which exist only here;
//   - a suggestion from a photo: text the vendor can copy into the draft.
// Only "Save for customers" changes what customers see, and it can change
// the description and the allergens and nothing else. A suggestion that
// fails, or a draft that is discarded, leaves the menu exactly as it was.
export default function DishEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLocale();
  const { account } = useAccount();
  const truckId = account.status === "signed-in" ? (account.truck?.id ?? null) : null;
  const formId = useId();

  // The saved dish. "missing" also covers a dish on someone else's truck:
  // this vendor's menu is the only one read here.
  const [loaded, setLoaded] = useState<{ key: string; dish: MenuItem | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${truckId}/${id}`;

  // Price and availability. Each has its own save and its own message.
  const [priceDraft, setPriceDraft] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const priceInFlight = useRef(false);
  const [priceNote, setPriceNote] = useState<{ kind: "saved"; price: string } | { kind: "problem"; problem: string } | { kind: "failed" } | { kind: "not_yours" } | null>(null);
  const [stockBusy, setStockBusy] = useState(false);
  const [stockNote, setStockNote] = useState<"out" | "back" | "failed" | "not_yours" | null>(null);

  // The draft.
  const [description, setDescription] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!truckId) return;
    let current = true;
    fetchMenu(supabaseBrowser(), truckId).then(
      (items) => {
        if (!current) return;
        const dish = items.find((item) => item.id === id) ?? null;
        setLoaded({ key, dish, failed: false });
        setDescription(dish?.description ?? "");
        setAllergens(dish?.allergens ?? []);
        setPriceDraft(dish ? priceText(dish.price_kwd) : "");
      },
      () => current && setLoaded({ key, dish: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [truckId, id, key, attempt]);
  const state = loaded && loaded.key === key ? loaded : null;
  const saved = state?.dish ?? null;

  // The photo and what came back for it.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const suggestionInFlight = useRef(false);
  const photoSequence = useRef(0);
  const [answer, setAnswer] = useState<SuggestResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<"saved" | "discarded" | "used" | "save_failed" | "not_yours" | null>(null);

  const dirty =
    saved !== null &&
    (tidyText(description) !== (saved.description ?? "") || [...allergens].sort().join() !== [...saved.allergens].sort().join());

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    const sequence = ++photoSequence.current;
    const blob = await shrinkPhoto(file);
    if (sequence !== photoSequence.current) return;
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    setAnswer(null);
    setNote(null);
  }

  // Sends the photo for a draft. Whatever happens, the two fields the vendor
  // has been typing in are not touched here.
  async function suggest() {
    if (!photo || suggestionInFlight.current) return;
    suggestionInFlight.current = true;
    setAsking(true);
    setConfirmed(false);
    setAnswer(null);
    setNote(null);
    const result = await requestSuggestion(id, photo.blob);
    if (result.remaining !== null) setRemaining(result.remaining);
    setAnswer(result);
    setAsking(false);
    suggestionInFlight.current = false;
  }

  // Only the fields that changed are replaced on screen, so a description
  // being typed is not lost when the price or availability is saved.
  function keepSaved(dish: MenuItem) {
    setLoaded({ key, dish, failed: false });
  }

  async function savePrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || priceInFlight.current) return;
    const parsed = parsePrice(priceDraft);
    if (!parsed.ok) return setPriceNote({ kind: "problem", problem: parsed.problem });
    if (parsed.price === priceText(saved.price_kwd)) return setPriceDraft(parsed.price);
    priceInFlight.current = true;
    setPriceBusy(true);
    setPriceNote(null);
    try {
      // The database checks the dish is on this vendor's truck and that the
      // price is more than zero. Its answer is the price the screen shows.
      const dish = await setDishPrice(supabaseBrowser(), saved.id, parsed.price);
      keepSaved(dish);
      setPriceDraft(priceText(dish.price_kwd));
      setPriceNote({ kind: "saved", price: priceText(dish.price_kwd) });
    } catch (error) {
      setPriceNote({ kind: error instanceof Error && error.message === "not_your_dish" ? "not_yours" : "failed" });
    } finally {
      priceInFlight.current = false;
      setPriceBusy(false);
    }
  }

  async function setSoldOut(soldOut: boolean) {
    if (!saved || stockBusy || saved.sold_out === soldOut) return;
    setStockBusy(true);
    setStockNote(null);
    try {
      const dish = await setDishSoldOut(supabaseBrowser(), saved.id, soldOut);
      keepSaved(dish);
      setStockNote(dish.sold_out ? "out" : "back");
    } catch (error) {
      setStockNote(error instanceof Error && error.message === "not_your_dish" ? "not_yours" : "failed");
    } finally {
      setStockBusy(false);
    }
  }

  /** Copies a suggestion into the draft. Still nothing is saved. */
  function copyDraft(suggestion: Suggestion) {
    setDescription(suggestion.description);
    setAllergens(suggestion.allergens);
    setConfirmed(false);
    setNote("used");
  }

  function discard() {
    if (!saved) return;
    setDescription(saved.description ?? "");
    setAllergens(saved.allergens);
    setConfirmed(false);
    setAnswer(null);
    setPhoto(null);
    if (fileInput.current) fileInput.current.value = "";
    setNote("discarded");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || saving || !dirty || !confirmed) return;
    setSaving(true);
    setNote(null);
    try {
      // The database checks the dish is on this vendor's truck and writes
      // the two fields. Its answer is what the screen then shows.
      const dish = await saveMenuCopy(supabaseBrowser(), saved.id, tidyText(description), allergens);
      setLoaded({ key, dish, failed: false });
      setDescription(dish.description ?? "");
      setAllergens(dish.allergens);
      setConfirmed(false);
      setAnswer(null);
      setNote("saved");
    } catch (error) {
      setNote(error instanceof Error && error.message === "not_your_dish" ? "not_yours" : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  const name = saved ? itemName(saved, locale) : t.menuEditorTitle;
  const list = (codes: string[]) => codes.map((code) => t.allergenName[code] ?? code).join(locale === "ar" ? "، " : ", ");
  const left = MAX_DESCRIPTION - description.length;
  const typedPrice = parsePrice(priceDraft);
  const priceChanged = saved !== null && (!typedPrice.ok || typedPrice.price !== priceText(saved.price_kwd));

  return (
    <div className="min-h-dvh">
      <AppHeader title={name} backHref="/vendor/menu" backLabel={t.backToMenu} />

      <main className="mx-auto max-w-[640px] px-4 pt-4 pb-10 md:px-6">
        {!state ? (
          <div role="status" aria-label={t.loading} className="space-y-3">
            <div className="h-28 rounded-panel bg-subtle" />
            <div className="h-64 rounded-panel bg-subtle" />
          </div>
        ) : state.failed ? (
          <LoadError title={t.menuLoadErrorTitle} body={t.ordersLoadErrorBody} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !saved ? (
          <div className="pt-10 text-center">
            <h2 className="text-2xl font-extrabold">{t.dishNotYoursTitle}</h2>
            <p className="mt-2 text-muted">{t.dishNotYoursBody}</p>
          </div>
        ) : (
          <>
            {/* What customers see now: the saved dish, never the draft. */}
            <section aria-labelledby={`${formId}-live`} className="rounded-panel border border-ink p-4">
              <h2 id={`${formId}-live`} className="text-sm font-semibold text-muted">
                {t.customersSee}
              </h2>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-lg leading-snug font-semibold">{name}</p>
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Money amount={saved.price_kwd} locale={locale} className="font-bold text-ink" />
                  {saved.sold_out && <span className="rounded-control bg-ink px-2 py-0.5 font-semibold text-snowy-white">{t.soldOut}</span>}
                </p>
              </div>
              <p className={saved.description ? "mt-1" : "mt-1 text-muted"}>{saved.description ?? t.menuNoDescription}</p>
              <p className="mt-1 text-sm text-muted">
                {saved.allergens.length > 0 ? t.mayContain(list(saved.allergens)) : t.noAllergensListed}
              </p>
            </section>

            {/* Price and availability: two labelled fields, each saved by itself. */}
            <section aria-labelledby={`${formId}-money`} className="mt-6">
              <h2 id={`${formId}-money`} className="text-lg font-extrabold">
                {t.priceAndAvailability}
              </h2>

              <form onSubmit={savePrice} noValidate className="mt-3">
                <label htmlFor={`${formId}-price`} className="block text-sm font-semibold">
                  {t.priceLabel}
                </label>
                <div className="mt-1 grid items-start gap-2 sm:flex">
                  <input
                    id={`${formId}-price`}
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    autoComplete="off"
                    value={priceDraft}
                    onChange={(event) => {
                      setPriceDraft(event.target.value);
                      setPriceNote(null);
                    }}
                    aria-invalid={priceNote?.kind === "problem" ? true : undefined}
                    aria-describedby={`${formId}-price-help`}
                    className={`block min-h-12 w-full sm:w-36 rounded-control border bg-snowy-white px-3 py-2 text-lg font-bold text-ink tabular-nums ${
                      priceNote?.kind === "problem" ? "border-error" : "border-outline"
                    }`}
                  />
                  <MorphingButton
                    type="submit"
                    disabled={!priceChanged || priceBusy}
                    aria-busy={priceBusy}
                    className={`${primaryButton} sm:w-auto! sm:min-w-56`}
                    state={priceBusy ? "pending" : priceNote?.kind === "saved" ? "success" : priceNote?.kind === "failed" ? "retry" : "idle"}
                    labels={{ idle: t.savePrice, pending: t.saving, success: locale === "ar" ? "تم حفظ السعر" : "Price saved", retry: `${t.retry}: ${t.savePrice}` }}
                  />
                </div>
                <p id={`${formId}-price-help`} className="mt-1 text-sm">
                  {priceNote?.kind === "problem" ? (
                    <span className="font-semibold text-error">{t.priceProblem[priceNote.problem]}</span>
                  ) : (
                    <span className="text-muted">{t.priceHint}</span>
                  )}
                </p>
                <div role="status">
                  {priceNote?.kind === "saved" && (
                    <p className="mt-2 flex items-start gap-2 rounded-control bg-ink p-3 font-semibold text-snowy-white">
                      <CheckIcon className="mt-0.5 size-5" />
                      <span>{t.priceSaved(formatKwd(priceNote.price, locale))}</span>
                    </p>
                  )}
                </div>
                {(priceNote?.kind === "failed" || priceNote?.kind === "not_yours") && (
                  <p role="alert" className="mt-2 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
                    {priceNote.kind === "not_yours" ? t.dishNotYoursBody : t.priceFailed}
                  </p>
                )}
              </form>

              <fieldset className="mt-5" disabled={stockBusy} aria-busy={stockBusy}>
                <legend className="text-sm font-semibold">{t.availabilityLegend}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[false, true].map((soldOut) => {
                    const chosen = saved.sold_out === soldOut;
                    return (
                      // Chosen: ink fill, light text and a check, so it does not rely on colour.
                      <label
                        key={String(soldOut)}
                        className={`relative flex min-h-12 cursor-pointer items-center gap-2 rounded-control border px-3 py-2 font-bold transition-colors duration-[120ms] ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                          chosen ? "border-ink bg-ink text-snowy-white" : "border-outline bg-snowy-white hover:border-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${formId}-stock`}
                          checked={chosen}
                          onChange={() => setSoldOut(soldOut)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <span className="min-w-0 flex-1">{soldOut ? t.soldOut : t.available}</span>
                        {chosen && <CheckIcon className="size-4" />}
                      </label>
                    );
                  })}
                </div>
                <p role="status" className="mt-1 min-h-5 text-sm font-semibold">
                  {stockBusy && t.saving}
                  {!stockBusy && stockNote === "out" && t.markedSoldOut}
                  {!stockBusy && stockNote === "back" && t.markedAvailable}
                </p>
                {(stockNote === "failed" || stockNote === "not_yours") && (
                  <p role="alert" className="mt-1 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
                    {stockNote === "not_yours" ? t.dishNotYoursBody : t.availabilityFailed}
                  </p>
                )}
              </fieldset>
            </section>

            {/* The photo, its suggestion and the allergens stay together (DESIGN.md, Menu editor). */}
            <section aria-labelledby={`${formId}-photo`} className="mt-6">
              <h2 id={`${formId}-photo`} className="text-lg font-extrabold">
                {t.photoTitle}
              </h2>
              <p className="mt-1 text-sm text-muted">{t.photoLead}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the vendor's own file
                  <img key={photo.url} src={photo.url} alt={t.photoChosen} className="vendor-photo size-24 rounded-control border border-divider object-cover" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <label className={`${secondaryButton} relative cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink`}>
                    <CameraIcon className="size-5" />
                    {photo ? t.changePhoto : t.choosePhoto}
                    <input
                      ref={fileInput}
                      type="file"
                      disabled={asking}
                      accept={PHOTO_TYPES.join(",")}
                      onChange={(event) => choosePhoto(event.target.files?.[0])}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  {photo && (
                    <>
                      <button type="button" disabled={asking} className={`${secondaryButton} text-sm`} onClick={() => {
                        ++photoSequence.current;
                        setPhoto(null); setAnswer(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}>{locale === "ar" ? "إزالة الصورة" : "Remove photo"}</button>
                      <button type="button" onClick={suggest} disabled={asking} aria-busy={asking} className={primaryButton}>
                        <span aria-live="polite">{asking ? (locale === "ar" ? "جارٍ إنشاء المسودة…" : "Generating draft…") : t.suggest}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* The suggestion: only text to review. */}
              {answer?.ok && (
                <div role="status" className="reveal-up mt-3 rounded-panel border border-ink bg-yellow-punk p-4">
                  <h3 className="font-extrabold">{t.suggestionTitle}</h3>
                  <p className="mt-1">{answer.suggestion.description}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {answer.suggestion.allergens.length > 0 ? t.mayContain(list(answer.suggestion.allergens)) : t.noAllergensListed}
                  </p>
                  <button type="button" onClick={() => copyDraft(answer.suggestion)} className={`${primaryButton} mt-3`}>
                    {t.useSuggestion}
                  </button>
                  <p className="mt-2 text-sm">{t.suggestionNote}</p>
                </div>
              )}

              {/* A failure: a clear message, a way to try again, and the draft below untouched. */}
              {answer && !answer.ok && (
                <div role="alert" className="mt-3 rounded-panel bg-error-surface p-4 text-error">
                  <p className="font-bold">
                    {answer.problem === "rate_limited" && answer.retryAt
                      ? t.rateLimitedUntil(formatKuwaitTime(answer.retryAt, locale))
                      : (t.suggestProblem[answer.problem] ?? t.suggestProblem.ai_failed)}
                  </p>
                  <p className="mt-1 text-sm">
                    {t.editsKept}
                    {answer.requestId && (
                      <>
                        {" "}
                        <bdi className="tabular-nums">{t.errorReference(answer.requestId)}</bdi>
                      </>
                    )}
                  </p>
                  {(answer.problem === "ai_failed" || answer.problem === "ai_busy") && (
                    <button type="button" onClick={suggest} disabled={asking} className={`${primaryButton} mt-3`}>
                      {t.retry}
                    </button>
                  )}
                </div>
              )}
              {remaining !== null && <p className="mt-2 text-sm text-muted tabular-nums">{t.suggestionsLeft(remaining)}</p>}
            </section>

            {/* The draft. Typing here changes nothing for customers. */}
            <form onSubmit={save} className="mt-6">
              <p role="status" className="min-h-6 text-sm font-semibold">
                {note === "used" && t.suggestionUsed}
                {note === "discarded" && t.discardedCopy}
              </p>

              <label htmlFor={`${formId}-description`} className="mt-1 block text-sm font-semibold">
                {t.descriptionLabel}
              </label>
              <textarea
                id={`${formId}-description`}
                rows={3}
                dir="auto"
                maxLength={MAX_DESCRIPTION}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setConfirmed(false);
                  setNote(null);
                }}
                aria-describedby={`${formId}-left`}
                className="mt-1 block w-full rounded-control border border-outline bg-snowy-white p-3 text-base text-ink"
              />
              <p id={`${formId}-left`} className="mt-1 text-sm text-muted tabular-nums">
                {t.descriptionLeft(left)}
              </p>

              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">{t.allergensLegend}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALLERGENS.map((code) => {
                    const on = allergens.includes(code);
                    return (
                      // Chosen: ink fill, light text and a check, so it does not rely on colour.
                      <label
                        key={code}
                        className={`relative flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm font-semibold transition-colors duration-[120ms] ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${
                          on ? "border-ink bg-ink text-snowy-white" : "border-outline bg-snowy-white hover:border-ink"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setAllergens((was) => (was.includes(code) ? was.filter((c) => c !== code) : [...was, code]));
                            setConfirmed(false);
                            setNote(null);
                          }}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <span className="min-w-0 flex-1">{t.allergenName[code]}</span>
                        {on && <CheckIcon className="size-4" />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* The vendor, not the photo, is who knows the recipe. */}
              <div className="mt-4 rounded-panel bg-warning-surface p-4 text-warning">
                <p className="font-extrabold">{t.checkAllergensTitle}</p>
                <p className="mt-1 text-sm">{t.checkAllergensBody}</p>
                <AllergenConfirmation checked={confirmed} onChange={setConfirmed} label={t.confirmAllergens} />
              </div>

              <div role="status">
                {note === "saved" && (
                  <p className="reveal-up mt-4 flex items-start gap-2 rounded-control bg-ink p-3 font-semibold text-snowy-white">
                    <CheckIcon className="mt-0.5 size-5" />
                    {t.savedCopy}
                  </p>
                )}
              </div>
              {(note === "save_failed" || note === "not_yours") && (
                <p role="alert" className="mt-4 rounded-control bg-error-surface p-3 text-sm font-semibold text-error">
                  {note === "not_yours" ? t.dishNotYoursBody : t.saveCopyFailed}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <button type="submit" disabled={!dirty || !confirmed || saving} aria-busy={saving} className={primaryButton}>
                  <span aria-live="polite">{saving ? t.savingCopy : t.saveForCustomers}</span>
                </button>
                <p className="text-center text-sm text-muted">
                  {!dirty ? t.noChanges : !confirmed ? t.confirmFirst : t.unsavedChanges}
                </p>
                <button type="button" onClick={discard} disabled={(!dirty && !answer && !photo) || saving} className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-40`}>
                  {t.discardChanges}
                </button>
              </div>
              <p className="mt-3 text-center text-sm text-muted">{t.priceUntouched}</p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
