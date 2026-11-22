import { bookingState, SLOT_STARTS } from "./park.ts";
import { slotSeconds } from "./time.ts";

export const TRUCKS = [
  { id: "T01", en: "Karak Corner", ar: "ركن الكرك", capacity: 10 },
  { id: "T02", en: "Dune Burgers", ar: "ديون برجر", capacity: 6 },
  { id: "T03", en: "Taco Saha", ar: "تاكو ساحة", capacity: 6 },
  { id: "T04", en: "Noodle Wagon", ar: "عربة النودلز", capacity: 5 },
  { id: "T05", en: "Saj Station", ar: "محطة الصاج", capacity: 8 },
  { id: "T06", en: "Lugaimat & Co", ar: "لقيمات وشركاه", capacity: 8 },
] as const;
export const REPLAY = [19 * 60, 19 * 60 + 15, 19 * 60 + 31] as const;
export const DEMO_DAY = 56;
export type Booking = {
  madeAt: number;
  removedAt?: number;
  removedStatus?: "cancelled" | "rejected";
};
export type Evening = {
  day: number;
  serviceDate?: string;
  truck: string;
  slot: string;
  capacity: number;
  closedAt?: number;
  bookings: Booking[];
};
const weekend = (day: number) => [4, 5].includes(day % 7); // day zero: Sunday, Kuwait
export const minute = (slot: string) => slotSeconds(slot) / 60;
export const timeString = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
/** Synthetic successful bookings only. Each number is minutes into the Kuwait service day. */
export function generateHistory(seed = 20261122, days = 57): Evening[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rows: Evening[] = [];
  for (let day = 0; day < days; day++) {
    const quiet = random() < 0.14 ? 0.35 : 0.85 + random() * 0.3;
    for (const [i, truck] of TRUCKS.entries()) {
      const closedAt =
        day === DEMO_DAY && i === 4
          ? 19 * 60 + 10
          : day % 13 === 8 && i === 3
            ? 18 * 60
            : undefined;
      for (const slot of SLOT_STARTS) {
        const end = minute(slot) - 15;
        const peak = [20.5, 19.5, 20, 19.75, 19.25, 21.5][i] * 60;
        const pressure = Math.min(
          0.99,
          (0.25 + 0.7 * Math.exp(-(((minute(slot) - peak) / 85) ** 2))) *
            quiet *
            (weekend(day) ? 1.15 : 1),
        );
        const bookings: Booking[] = [];
        for (let seat = 0; seat < truck.capacity; seat++)
          if (random() < pressure) {
            const madeAt = Math.floor(end - 5 - random() ** 1.8 * 110);
            if (closedAt !== undefined && madeAt >= closedAt) continue;
            const removedAt =
              random() < 0.04
                ? Math.min(end, madeAt + 10 + Math.floor(random() * 25))
                : undefined;
            bookings.push({
              madeAt,
              ...(removedAt === undefined
                ? {}
                : { removedAt, removedStatus: "cancelled" as const }),
            });
          }
        rows.push({
          day,
          serviceDate: new Date(Date.UTC(2026, 8, 27 + day))
            .toISOString()
            .slice(0, 10),
          truck: truck.id,
          slot,
          capacity: truck.capacity,
          closedAt,
          bookings: bookings.sort((a, b) => a.madeAt - b.madeAt),
        });
      }
    }
  }
  return rows;
}
export function known(row: Evening, now: number): number {
  // Status changes are time-stamped too: a future cancellation cannot leak into the replay.
  return row.bookings.filter(
    (b) => b.madeAt <= now && (b.removedAt === undefined || b.removedAt > now),
  ).length;
}
export function forecast(history: Evening[], row: Evening, now: number) {
  const current = known(row, now),
    cutoff = minute(row.slot) - 15;
  const state = bookingState({
    slot: row.slot,
    booked: current,
    capacity: row.capacity,
    truckClosed: row.closedAt !== undefined && row.closedAt <= now,
    nowSeconds: now * 60,
  });
  const candidates = history.filter(
    (h) =>
      h.day < row.day &&
      h.truck === row.truck &&
      h.slot === row.slot &&
      weekend(h.day) === weekend(row.day) &&
      (h.closedAt === undefined || h.closedAt > cutoff),
  );
  const similar = candidates
    .sort(
      (a, b) =>
        Math.abs(known(a, now) - current) - Math.abs(known(b, now) - current) ||
        b.day - a.day,
    )
    .slice(0, 12);
  const samples = similar
    .map((h) => Math.max(0, known(h, cutoff) - known(h, now)))
    .sort((a, b) => a - b);
  const mean = samples.length
    ? samples.reduce((a, b) => a + b, 0) / samples.length
    : 0;
  const room = Math.max(0, row.capacity - current);
  const additional = state === "open" ? Math.min(room, mean) : 0;
  const projected = Math.min(row.capacity, current + additional);
  const low =
    state === "open" && samples.length
      ? Math.min(
          row.capacity,
          current + samples[Math.floor((samples.length - 1) * 0.1)],
        )
      : current;
  const high =
    state === "open" && samples.length
      ? Math.min(
          row.capacity,
          current + samples[Math.ceil((samples.length - 1) * 0.9)],
        )
      : current;
  const fillShare = samples.length
    ? samples.filter((n) => n >= room).length / samples.length
    : 0;
  return {
    truck: row.truck,
    slot: row.slot,
    capacity: row.capacity,
    now,
    cutoff,
    current,
    additional,
    projected,
    low,
    high,
    n: samples.length,
    mean,
    fillShare,
    state:
      state !== "open"
        ? state
        : samples.length < 5
          ? "limited"
          : projected >= row.capacity - 0.5
            ? "likely"
            : high >= row.capacity
              ? "risk"
              : "open",
    comparableDays: similar.map((h) => h.day),
  };
}
export type Forecast = ReturnType<typeof forecast>;
export const isBookable = (f: Forecast) =>
  !["full", "truck_closed", "deadline_passed"].includes(f.state);
export function dashboard(history: Evening[], day: number, now: number) {
  const rows = history.filter((h) => h.day === day);
  const cells = rows.map((r) => forecast(history, r, now));
  const window = cells.filter(
    (f) => minute(f.slot) > now && minute(f.slot) <= now + 60 && isBookable(f),
  );
  const risk = window
    .filter((f) => f.n >= 5 && f.high >= f.capacity)
    .sort(
      (a, b) =>
        b.fillShare - a.fillShare ||
        a.cutoff - b.cutoff ||
        b.projected / b.capacity - a.projected / a.capacity ||
        a.truck.localeCompare(b.truck),
    );
  const windows = [...new Set(window.map((f) => f.slot))].map((slot) => ({
    slot,
    projected: window
      .filter((f) => f.slot === slot)
      .reduce((n, f) => n + f.projected, 0),
    capacity: window
      .filter((f) => f.slot === slot)
      .reduce((n, f) => n + f.capacity, 0),
  }));
  windows.sort(
    (a, b) =>
      b.projected / b.capacity - a.projected / a.capacity ||
      a.slot.localeCompare(b.slot),
  );
  return {
    cells,
    window,
    risk,
    expected: window.reduce((n, f) => n + f.additional, 0),
    busiest: windows[0] ?? null,
  };
}
/** Fixed first 42 evenings train; latest 14 never enter training, even for later held-out days. */
export function validate(history = generateHistory()) {
  const training = history.filter((h) => h.day < 42);
  let model = 0,
    baseline = 0,
    n = 0;
  for (const row of history.filter((h) => h.day >= 42 && h.day < 56))
    for (const lead of [30, 60, 90]) {
      const now = minute(row.slot) - lead,
        f = forecast(training, row, now);
      if (!isBookable(f) || f.n < 5) continue;
      const actual = known(row, minute(row.slot) - 15);
      model += Math.abs(f.projected - actual);
      baseline += Math.abs(f.current - actual);
      n++;
    }
  return {
    modelMAE: model / n,
    baselineMAE: baseline / n,
    samples: n,
    evenings: 14,
    trainingEvenings: 42,
  };
}
export function explanation(f: Forecast, locale: "en" | "ar") {
  const n = (x: number) => Number(x.toFixed(1));
  return locale === "ar"
    ? `توقع تجريبي: ${f.current} من ${f.capacity} محجوزة الآن. نتوقع ${n(f.additional)} طلبات إضافية، ليصبح الإجمالي ${n(f.projected)}، ضمن نطاق ${f.low}–${f.high}. استندنا إلى ${f.n} أمسيات مشابهة. ${f.state === "deadline_passed" || f.state === "truck_closed" ? "الحجز مغلق؛ لا حجوزات جديدة متوقعة." : "راجع المطبخ قبل إغلاق الحجز؛ القرار لك."}`
    : `Demo forecast: ${f.current} of ${f.capacity} booked now. About ${n(f.additional)} more bookings gives ${n(f.projected)} projected, with a range of ${f.low}–${f.high}. Based on ${f.n} similar evenings. ${f.state === "deadline_passed" || f.state === "truck_closed" ? "Booking is closed; no new bookings expected." : "Check with the kitchen before booking closes; the decision stays with you."}`;
}
