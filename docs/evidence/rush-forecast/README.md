# Rush Forecast — review evidence

[Normal-speed mobile replay](mobile-replay.webm) · [Desktop dashboard and detail](1440-en.png) · [Arabic desktop](1440-ar.png)

## What to demonstrate

Manager → Park overview → Forecast. The persistent label says **Demo forecast · simulated history**. At 7:00 PM select the first ranked slot: Noodle Wagon, 7:45 PM. Four places are known booked, one more is expected, projected 5/5 with a 4–5 range. Advance to 7:15 PM, then 7:31 PM. Booking has closed at 7:30 PM and the simulated actual is 5; the 7:00 PM prediction's absolute error is 0 orders. The recording is about 20 seconds at normal speed, with no time compression or reordered events. The live occupancy tab is separate.

## Provenance and reproducibility

Local Next.js production build; Chromium 159 on Windows, touch emulation at 390 × 844 for recording. Functional screenshots: English and Arabic at 320/390 × 900 and desktop 1440 × 900. No physical phone tested. Browser auth/occupancy are fixtures; the forecast is the real deterministic generator/model, not mocked results. No Production orders, payments, capacity changes or closures were made.

`pnpm test:browser tests/browser/rush-forecast.spec.ts` regenerates the screenshots, recording and validation JSON using a local-only Supabase fixture URL. `pnpm test:unit` checks generator reproducibility, no future-booking/cancellation leakage, cutoff inclusivity, closures, capacity bounds, sparse history, empty KPIs, fixed holdout membership and HTTP manager-only/fallback behavior.

Generator: `lib/rush.ts`, seed 20261122, 57 evenings beginning 27 September 2026. The synthetic history never enters Production tables. Integer `madeAt`/`removedAt` values are Kuwait minutes within `serviceDate`; pickup windows use the app's 24 quarter-hours. Thursday/Friday are the simulated high-pressure evening group, distinct from other nights. Do not interpret these fabricated patterns as measured Kuwaiti customer behavior.

## Measured simulated accuracy

| Method | Mean absolute error, orders per slot |
| --- | ---: |
| Comparable-evening forecast | 0.8972 |
| No more bookings baseline | 2.0601 |

[Exact results](validation.json): 5,940 eligible slot/cutoff predictions across the latest 14 held-out evenings, trained only on the first 42. Cutoffs are 90/60/30 minutes before pickup. Both methods use the same samples; multiple cutoffs on a slot are correlated. Demo evening 57 is separate. The likely range is the empirical 10th–90th percentile of comparable additional bookings, capped at capacity, not a calibrated confidence interval. “Likely to fill” means projected occupancy rounds to capacity; “At risk” means room now and the range reaches capacity. Observed successful bookings cannot identify excess demand beyond sell-out.

## Explanation and access checks

[Real OpenRouter smoke results](openrouter-smoke.json): English and Arabic explanations from the actual provider, running the local server handler with a real Production manager login and read-only profile verification. Only recomputed aggregates were sent. No booking records, names, emails or tokens appear in the prompt or this evidence. This is not evidence of a deployed Preview route invocation.

UI checks force provider unavailability and confirm a usable deterministic explanation. The HTTP-handler unit tests reject anonymous/customer/vendor callers before provider access, recompute browser-supplied figures, and handle provider failure in both languages. The real route verifies `auth.getUser` and the user's own manager profile before invoking that handler's explanation path. Truncated output, unsupported numeric claims and provider failure fall back safely.

The final browser assertions compare KPI totals, selected-slot projection, chart accessible figures and explanation request selection/language against the same replay time at all six viewport/language combinations. Replay works with keyboard Enter and touch. A customer fixture requests its own home instead of displaying the forecast; that destination's server-rendered data is deliberately unavailable in the isolated fixture.

## Checks

- Lint and typecheck passed.
- 116 unit tests passed.
- 83 database assertions passed; the unrestricted Windows run exited 0. The initial sandboxed run stalled in PostgreSQL teardown after passing assertions, so it is not the exit-status evidence.
- Existing full browser suite plus forecast: 43 passed. The forecast suite was then strengthened to assert cross-widget figures and rerun after final copy/capture updates.
- Production build passes as part of the browser test command.

Screenshots with `-dashboard` show the initial viewport; full-page screenshots include sticky elements at their capture position. The mobile recording is the best evidence of scrolling and the persistent replay controls. Live forecasting remains unavailable until real longitudinal booking/status events are connected and validated. These simulated results do not establish live accuracy.
