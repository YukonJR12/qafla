"use client";
import { useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/locale";
import { formatSlot } from "@/lib/time";
import {
  DEMO_DAY,
  REPLAY,
  TRUCKS,
  dashboard,
  explanation,
  forecast,
  generateHistory,
  known,
  timeString,
  validate,
  type Forecast,
  type Evening,
} from "@/lib/rush";
import "./rush-forecast.css";

const history = generateHistory();
const performance = validate(history);
const number = (n: number) => Number(n.toFixed(1));
export function RushForecast({ token }: { token: string }) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const words = (en: string, arabic: string) => (ar ? arabic : en);
  const [step, setStep] = useState(0),
    now = REPLAY[step];
  const view = useMemo(() => dashboard(history, DEMO_DAY, now), [now]);
  const [selection, setSelection] = useState(() => {
    const f = dashboard(history, DEMO_DAY, REPLAY[0]).risk[0];
    return f ? `${f.truck}/${f.slot}` : "T02/19:30:00";
  });
  const f = view.cells.find((c) => `${c.truck}/${c.slot}` === selection)!;
  const row = history.find(
    (r) => r.day === DEMO_DAY && r.truck === f.truck && r.slot === f.slot,
  )!;
  const earlier = forecast(history, row, REPLAY[0]);
  const closed = f.state === "deadline_passed";
  const [breakdown, setBreakdown] = useState(false);
  const [answer, setAnswer] = useState<{
    key: string;
    text: string;
    source: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef(0);
  const key = `${selection}/${now}/${locale}`;
  const detail = useRef<HTMLElement>(null);
  const time = (m: number) => formatSlot(timeString(m), locale);
  const name = (id: string) => TRUCKS.find((t) => t.id === id)![locale];
  const state = (c: Forecast) =>
    ({
      full: words("Full", "ممتلئ"),
      truck_closed: words("Truck closed", "العربة مغلقة"),
      deadline_passed: words("Booking closed", "الحجز مغلق"),
      limited: words("Limited history", "سجل محدود"),
      likely: words("Likely to fill", "مرجّح أن يمتلئ"),
      risk: words("At risk", "معرّض للامتلاء"),
      open: words("Room expected", "أماكن متوقعة"),
    })[c.state];
  function select(c: Forecast) {
    pending.current++;
    setLoading(false);
    setSelection(`${c.truck}/${c.slot}`);
    requestAnimationFrame(() =>
      detail.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  }
  function replay(index: number) {
    pending.current++;
    setLoading(false);
    setStep(index);
  }
  async function explain() {
    const request = ++pending.current;
    setLoading(true);
    try {
      const response = await fetch("/api/manager/forecast/explain", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ truck: f.truck, slot: f.slot, now, locale }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (request === pending.current)
        setAnswer({ key, text: data.explanation, source: data.source });
    } catch {
      if (request === pending.current)
        setAnswer({ key, text: explanation(f, locale), source: "fallback" });
    } finally {
      if (request === pending.current) setLoading(false);
    }
  }
  const visibleSlots = [
    "19:15:00",
    "19:30:00",
    "19:45:00",
    "20:00:00",
    "20:15:00",
    "20:30:00",
  ];
  const first = view.risk[0];
  return (
    <section className="rush" aria-labelledby="rush-title" data-now={now}>
      <div className="rush-clock">
        <div>
          <h2 id="rush-title">{words("Rush Forecast", "توقع الإقبال")}</h2>
          <p className="rush-demo">
            {words(
              "Demo forecast · simulated history",
              "توقع تجريبي · سجل محاكى",
            )}
          </p>
        </div>
        <div>
          <strong>{words("Replay the evening", "إعادة عرض الأمسية")}</strong>
          <div
            className="rush-times"
            aria-label={words("Replay time · Kuwait", "وقت العرض · الكويت")}
          >
            {REPLAY.map((m, i) => (
              <button
                key={m}
                aria-pressed={step === i}
                onClick={() => replay(i)}
              >
                {time(m)}
              </button>
            ))}
          </div>
          <small>
            {words(
              "Kuwait time · Sunday demo",
              "توقيت الكويت · تجربة يوم الأحد",
            )}
          </small>
        </div>
      </div>
      <p className="rush-intro">
        {words(
          "Live forecast unavailable: comparable booking history is not connected yet. Explore the demo; live occupancy remains in Overview.",
          "التوقع الفعلي غير متاح: سجل الحجوزات المقارن غير متصل بعد. استكشف التجربة؛ الإشغال الفعلي في النظرة العامة.",
        )}
      </p>
      <p className="rush-window">
        {words(
          "Next 60 minutes · slots still open for booking",
          "الـ60 دقيقة القادمة · الفترات المتاحة للحجز",
        )}
      </p>
      <div className="rush-kpis">
        <button
          onClick={() => {
            if (first) select(first);
          }}
          className="rush-kpi rush-risk"
        >
          <span>{words("Slots at risk", "فترات معرّضة للامتلاء")}</span>
          <strong data-testid="risk-count">{view.risk.length}</strong>
          <small>
            {first
              ? `${name(first.truck)} · ${formatSlot(first.slot, locale)}`
              : words(
                  "No open slots reach capacity in the range",
                  "لا فترات مفتوحة يصل نطاقها إلى السعة",
                )}
          </small>
        </button>
        <button
          onClick={() => setBreakdown((v) => !v)}
          aria-expanded={breakdown}
          className="rush-kpi"
        >
          <span>{words("Expected new bookings", "حجوزات جديدة متوقعة")}</span>
          <strong data-testid="expected-count">{number(view.expected)}</strong>
          <small>
            {words(
              "Orders · tap for truck breakdown",
              "طلبات · اضغط للتفصيل حسب العربة",
            )}
          </small>
        </button>
        <div className="rush-kpi">
          <span>
            {words("Busiest upcoming window", "أكثر فترة قادمة ازدحاماً")}
          </span>
          <strong>
            {view.busiest ? formatSlot(view.busiest.slot, locale) : "—"}
          </strong>
          <small>
            {view.busiest
              ? words(
                  `${number(view.busiest.projected)} of ${view.busiest.capacity} places`,
                  `${number(view.busiest.projected)} من ${view.busiest.capacity} مكاناً`,
                )
              : words(
                  "No bookable slots in the next hour",
                  "لا فترات متاحة للحجز خلال الساعة القادمة",
                )}
          </small>
        </div>
      </div>
      {breakdown && (
        <ul className="rush-breakdown">
          {TRUCKS.map((t) => (
            <li key={t.id}>
              {t[locale]}{" "}
              <b>
                {number(
                  view.window
                    .filter((f) => f.truck === t.id)
                    .reduce((n, f) => n + f.additional, 0),
                )}
              </b>
            </li>
          ))}
        </ul>
      )}
      <details className="rush-method">
        <summary>{words("How are slots ranked?", "كيف تُرتّب الفترات؟")}</summary>
        <p>
          {words(
            "Room now, but the likely range reaches capacity. Rank by the share of similar evenings that would fill the remaining places, then earliest booking cutoff, then projected occupancy. Check the first kitchen now, before the cutoff—not a preparation-time estimate. Busiest window uses projected occupancy as a share of still-bookable capacity; full and closed slots are excluded from these KPIs.",
            "أماكن متاحة الآن لكن النطاق المتوقع يصل إلى السعة. الترتيب حسب نسبة الأمسيات المشابهة التي تملأ الأماكن المتبقية، ثم أقرب موعد لإغلاق الحجز، ثم الإشغال المتوقع. راجع المطبخ الأول الآن قبل الإغلاق؛ هذا ليس تقديراً لوقت التحضير. تعتمد الفترة الأشد ازدحاماً على نسبة الإشغال للسعة المتاحة للحجز؛ تُستبعد الفترات الممتلئة والمغلقة من المؤشرات.",
          )}
        </p>
      </details>
      <div className="rush-ranked">
        <h3>{words("Check these kitchens first", "راجع هذه المطابخ أولاً")}</h3>
        {(view.risk.length ? view.risk : view.window.slice(0, 3))
          .slice(0, 4)
          .map((c) => (
            <button
              key={c.truck + c.slot}
              onClick={() => select(c)}
              aria-pressed={selection === `${c.truck}/${c.slot}`}
            >
              <span>
                <b>{name(c.truck)}</b>
                <small>
                  {formatSlot(c.slot, locale)} · {state(c)}
                </small>
              </span>
              <span>
                <b>
                  {number(c.projected)}/{c.capacity}
                </b>
                <small>
                  {words(
                    `${number(c.capacity - c.projected)} places left`,
                    `${number(c.capacity - c.projected)} أماكن متبقية`,
                  )}
                </small>
              </span>
            </button>
          ))}
        {!view.window.length && (
          <p>
            {words(
              "No slots are open in this hour.",
              "لا فترات مفتوحة في هذه الساعة.",
            )}
          </p>
        )}
      </div>
      <label className="rush-mobile-select">
        {words("Inspect any slot", "افحص أي فترة")}
        <select
          value={selection}
          onChange={(e) =>
            select(
              view.cells.find(
                (c) => `${c.truck}/${c.slot}` === e.target.value,
              )!,
            )
          }
        >
          {view.cells
            .filter((c) => visibleSlots.includes(c.slot))
            .map((c) => (
              <option key={c.truck + c.slot} value={`${c.truck}/${c.slot}`}>
                {name(c.truck)} · {formatSlot(c.slot, locale)} · {state(c)}
              </option>
            ))}
        </select>
      </label>
      <div className="rush-matrix">
        <h3>
          {words("Projected bookings / capacity", "الحجوزات المتوقعة / السعة")}
        </h3>
        <div
          role="region"
          aria-label={words(
            "Truck by pickup time forecast",
            "توقع العربة حسب وقت الاستلام",
          )}
          tabIndex={0}
          className="rush-table-scroll"
        >
          <table>
            <thead>
              <tr>
                <th>{words("Truck", "العربة")}</th>
                {visibleSlots.map((s) => (
                  <th key={s}>{formatSlot(s, locale)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRUCKS.map((t) => (
                <tr key={t.id}>
                  <th>{t[locale]}</th>
                  {visibleSlots.map((s) => {
                    const c = view.cells.find(
                      (f) => f.truck === t.id && f.slot === s,
                    )!;
                    return (
                      <td key={s}>
                        <button
                          className={`rush-cell ${c.state}`}
                          onClick={() => select(c)}
                          aria-pressed={selection === `${c.truck}/${c.slot}`}
                          aria-label={`${t[locale]} ${formatSlot(s, locale)} ${number(c.projected)}/${c.capacity} ${state(c)}`}
                        >
                          <b>
                            {number(c.projected)}/{c.capacity}
                          </b>
                          <small>{state(c)}</small>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <section
        ref={detail}
        tabIndex={-1}
        className="rush-detail"
        aria-labelledby="rush-selected"
        data-testid="forecast-detail"
        data-truck={f.truck}
        data-slot={f.slot}
      >
        <div className="rush-detail-heading">
          <div>
            <h3 id="rush-selected">
              {name(f.truck)} · {formatSlot(f.slot, locale)}
            </h3>
            <p>
              {state(f)} · {words("As of", "عند")} {time(now)}
            </p>
          </div>
          <b className="rush-remaining">
            {words(
              `${number(f.capacity - f.projected)} places likely left`,
              `${number(f.capacity - f.projected)} أماكن متوقعة متبقية`,
            )}
          </b>
        </div>
        <p>
          {words(
            `${f.current} of ${f.capacity} booked. About ${number(f.additional)} more orders expected before booking closes.`,
            `${f.current} من ${f.capacity} محجوزة. نتوقع نحو ${number(f.additional)} طلبات إضافية قبل إغلاق الحجز.`,
          )}
        </p>
        <p className="rush-projection">
          {words("Projected occupancy", "الإشغال المتوقع")}:{" "}
          <b data-testid="projection">
            {number(f.projected)} / {f.capacity}
          </b>{" "}
          · {words("Likely range", "النطاق المتوقع")}:{" "}
          <b>
            <bdi>
              {f.low}–{f.high}
            </bdi>
          </b>
        </p>
        <p>
          {f.cutoff >= now && f.state !== "truck_closed"
            ? words(
                `Check the kitchen now; booking closes at ${time(f.cutoff)} (${f.cutoff - now} minutes).`,
                `راجع المطبخ الآن؛ يغلق الحجز عند ${time(f.cutoff)} (بعد ${f.cutoff - now} دقيقة).`,
              )
            : words(
                "No new bookings expected: this booking window is closed.",
                "لا حجوزات جديدة متوقعة: نافذة الحجز هذه مغلقة.",
              )}
        </p>
        <Pace row={row} f={f} earlier={earlier} locale={locale} />
        {closed && (
          <p className="rush-outcome" role="status">
            {words(
              `${name(f.truck)} · ${formatSlot(f.slot, locale)}. At ${time(REPLAY[0])}: predicted ${number(earlier.projected)}. Actual at close: ${known(row, f.cutoff)}. Absolute error: ${number(Math.abs(earlier.projected - known(row, f.cutoff)))} orders.`,
              `${name(f.truck)} · ${formatSlot(f.slot, locale)}. عند ${time(REPLAY[0])}: التوقع ${number(earlier.projected)}. الفعلي عند الإغلاق: ${known(row, f.cutoff)}. الخطأ المطلق: ${number(Math.abs(earlier.projected - known(row, f.cutoff)))} طلبات.`,
            )}
          </p>
        )}
        <details>
          <summary>
            {words(
              "Inspect the model and comparable evenings",
              "افحص النموذج والأمسيات المشابهة",
            )}
          </summary>
          <p>
            {words(
              `Same truck, pickup slot and evening group (Thu/Fri or other days). Select up to 12 past evenings with the closest booked count at this time. ${f.n} evenings contribute; their mean additional bookings is ${number(f.mean)}. The 10th–90th empirical percentile is a likely range, not a calibrated guarantee. Successful bookings cannot reveal lost demand after sell-out.`,
              `نفس العربة والفترة ومجموعة الأيام (الخميس والجمعة أو بقية الأيام). نختار حتى 12 أمسية سابقة بأقرب عدد حجوزات عند هذا الوقت. تساهم ${f.n} أمسيات بمتوسط ${number(f.mean)} حجوزات إضافية. النطاق بين المئينين 10 و90 تجريبي وليس ضماناً. الحجوزات الناجحة لا تكشف الطلب المفقود بعد الامتلاء.`,
            )}
          </p>
          <p>
            {words("Simulated evening IDs", "معرّفات الأمسيات المحاكاة")}:{" "}
            {f.comparableDays.join(", ")}
          </p>
        </details>
        <button className="rush-explain" disabled={loading} onClick={explain}>
          {loading
            ? words("Explaining…", "جارٍ الشرح…")
            : words("Explain this forecast", "اشرح هذا التوقع")}
        </button>
        <div aria-live="polite" className="rush-explanation">
          <strong>
            {answer?.key === key && answer.source === "openrouter"
              ? words("OpenRouter explanation", "شرح OpenRouter")
              : words("Rule-based explanation", "شرح مبني على القواعد")}
          </strong>
          <p>{answer?.key === key ? answer.text : explanation(f, locale)}</p>
        </div>
      </section>
      <section className="rush-performance">
        <h3>
          {words("Model performance · simulated", "أداء النموذج · محاكاة")}
        </h3>
        <p>
          {words(
            "Average absolute error · orders per slot",
            "متوسط الخطأ المطلق · طلبات لكل فترة",
          )}
        </p>
        <div>
          <b>
            {words("Forecast", "التوقع")}: {performance.modelMAE.toFixed(2)}
          </b>
          <b>
            {words("No-more-bookings baseline", "خط الأساس: لا حجوزات إضافية")}:{" "}
            {performance.baselineMAE.toFixed(2)}
          </b>
        </div>
        <p>
          {words(
            `${performance.samples} slot/cutoff predictions across 14 held-out evenings; 42 earlier evenings train the model. Cutoffs: 30, 60 and 90 minutes before pickup. Same samples for both models.`,
            `${performance.samples} توقعات للفترة والوقت عبر 14 أمسية اختبار؛ التدريب على 42 أمسية أسبق. التوقع قبل الاستلام بـ30 و60 و90 دقيقة. نفس العينات للنموذجين.`,
          )}
        </p>
        <p>
          {words(
            "Simulated accuracy does not establish live accuracy. Advisory only: capacity and closure decisions remain yours.",
            "دقة المحاكاة لا تثبت الدقة الفعلية. التوقع استشاري؛ قرارات السعة والإغلاق تبقى لك.",
          )}
        </p>
      </section>
    </section>
  );
}
function Pace({
  row,
  f,
  earlier,
  locale,
}: {
  row: Evening;
  f: Forecast;
  earlier: Forecast;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar",
    start = Math.min(f.now, f.cutoff) - 100,
    end = Math.max(f.now, f.cutoff) + 5;
  const x = (m: number) => 42 + ((m - start) / (end - start)) * 470,
    y = (n: number) => 160 - (n / row.capacity) * 115;
  const observed = Array.from(
    { length: Math.ceil((Math.min(f.now, f.cutoff) - start) / 5) + 1 },
    (_, i) => Math.min(f.now, f.cutoff, start + i * 5),
  );
  const points = observed.map((m) => `${x(m)},${y(known(row, m))}`).join(" ");
  return (
    <figure className="rush-pace">
      <figcaption>
        {ar ? "وتيرة الحجز · طلبات" : "Booking pace · orders"}
      </figcaption>
      <svg
        viewBox="0 0 550 215"
        role="img"
        aria-label={
          ar
            ? `المحجوز ${f.current}، المتوقع ${number(f.projected)}، النطاق ${f.low} إلى ${f.high}، السعة ${f.capacity}`
            : `Observed ${f.current}, projected ${number(f.projected)}, range ${f.low} to ${f.high}, capacity ${f.capacity}`
        }
        style={{ direction: "ltr" }}
      >
        <line
          x1="42"
          y1={y(row.capacity)}
          x2="520"
          y2={y(row.capacity)}
          stroke="#6F4100"
          strokeWidth="2"
        />
        <text x="44" y="30">
          {ar ? "السعة" : "Capacity"} {row.capacity}
        </text>
        {[0, Math.floor(row.capacity / 2)].map((n) => (
          <g key={n}>
            <line x1="42" x2="520" y1={y(n)} y2={y(n)} stroke="#D9D7DD" />
            <text x="14" y={y(n) + 5}>
              {n}
            </text>
          </g>
        ))}
        {f.now <= f.cutoff && (
          <>
            <polygon
              points={`${x(f.now)},${y(f.current)} ${x(f.cutoff)},${y(f.high)} ${x(f.cutoff)},${y(f.low)}`}
              fill="#C6F900"
              fillOpacity=".5"
            />
            <line
              x1={x(f.now)}
              y1={y(f.current)}
              x2={x(f.cutoff)}
              y2={y(f.projected)}
              stroke="#101010"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
          </>
        )}
        {f.now > f.cutoff && (
          <line
            x1={x(earlier.now)}
            y1={y(earlier.current)}
            x2={x(f.cutoff)}
            y2={y(earlier.projected)}
            stroke="#767277"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}
        <polyline
          points={points}
          fill="none"
          stroke="#101010"
          strokeWidth="3"
        />
        <circle
          cx={x(Math.min(f.now, f.cutoff))}
          cy={y(f.current)}
          r="4"
          fill="#F42902"
        />
        <line
          x1={x(f.now)}
          x2={x(f.now)}
          y1="40"
          y2="165"
          stroke="#8B1830"
          strokeDasharray="3 3"
        />
        <text x={Math.min(490, x(f.now))} y="20" textAnchor="middle">
          {ar ? "الآن" : "Now"}
        </text>
        <text x="42" y="207">
          {formatSlot(timeString(start), locale)}
        </text>
        <text x="515" y="207" textAnchor="end">
          {formatSlot(timeString(f.cutoff), locale)} ·{" "}
          {ar ? "إغلاق الحجز" : "Cutoff"}
        </text>
      </svg>
      <p>
        {ar
          ? "خط متصل: المرصود · متقطع: التوقع · مظلل: النطاق"
          : "Solid: observed · dashed: projection · shaded: range"}
      </p>
    </figure>
  );
}
