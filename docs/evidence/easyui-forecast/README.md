# Rush Forecast interactions — EasyUI adaptations

[390 px normal-speed replay](mobile-replay.webm) · [Desktop dashboard](1440-en-dashboard.png) · [320 px Arabic chart](320-ar-pace.png)

Tested forecast implementation: **d39da06**. Final recording and screenshots use local combined build **a7c68e1**: customer PR19 (`7e35120`), vendor PR20 (`0640cd0`) and this forecast implementation. Main/Production were not changed. Base for all three is **53f593a**.

Environment: local Next **production builds**, Playwright Chromium **159.0.8154.6** on Windows. Chrome emulation at 320×900 and 390×900, desktop 1440×900; recording 390×844. English/Arabic, keyboard, mouse and emulated touch. Both 320 px runs use reduced motion. These are not physical-device observations.

## Source mapping

Adapted the [MIT EasyUI source at 1506593](https://github.com/Surajmaurya1/easyui/tree/15065930b3ee3991b4aece5713a6bfbca7a782f7/src/components/ui); [license retained](EasyUI-LICENSE). No animation/chart library or other runtime dependency added.

| EasyUI component | Qafla placement | Treatment |
|---|---|---|
| [Stat Card](https://easyui.site/components/stat-card) | Existing Rush Forecast KPI cards | Adapted label/value/context layout and visual grouping. No count-up; time horizon, units and busiest-window occupancy remain visible. |
| [Animated Number Morph](https://easyui.site/components/animated-number) | `forecast-number.tsx`, inside KPIs | Adapted rolling digit-column source using CSS. Initial value is immediate, digit widths align, decorative columns are hidden from screen readers, final value is announced once. Reduced motion changes immediately. |
| [Activity Heatmap](https://easyui.site/components/activity-heatmap) | Six-truck matrix | Adapted focused/highlighted cell interaction and directional navigation to native table buttons. Roving tab stop, arrows/Home/End, RTL physical direction; pointer and keyboard update the same selected slot. |
| [Interactive Area Chart](https://easyui.site/components/interactive-area-chart) | Existing SVG booking pace | Adapted pointer scrub and keyboard inspection. Native 44 px range control is also available. Observations stop at selected replay time; future scrub points interpolate the model's dashed projection and range, never reveal future actual bookings. Cutoff label aligns with the actual cutoff position. |
| [Expandable Data Row](https://easyui.site/components/expandable-data-row) | Mobile ranked kitchens | Adapted controlled disclosure in place, with current/projected/range/capacity/reason and a booking-pace action. Close preserves row position. Selected slot remains in the list after Full/Booking closed. |

All five read the existing selected slot and replay time. The forecasting algorithm and server authorization are unchanged. “Demo forecast · simulated history” remains in the sticky header throughout, in both languages. Existing AI-powered wording is retained.

## Observed replay and explanation

The controlled fixture uses the existing fixed-seed generator and database-shaped history response; it makes no Production writes.

| Replay | Selected slot | Current / capacity | Projection | Range | State |
|---|---|---:|---:|---:|---|
| 7:00 PM | T04 Noodle Wagon · 7:45 PM | 4 / 5 | 5 | 4–5 | Likely to fill |
| 7:15 PM | Same | 5 / 5 | 5 | 5–5 | Full |
| 7:46 PM | Same; cutoff was 7:30 PM | 5 / 5 | 5 | 5–5 | Booking closed |

Original 7:00 PM prediction **5**, actual simulated final count **5**, absolute error **0 orders**. Rewind restores the original prediction exactly. At 7:00 PM the KPI cards show **9** at-risk slots, **38.6** expected additional orders, and busiest window **7:45 PM · 34.4 / 43 places**.

The browser test checks the explanation request's selected truck, slot, language and replay time, then supplies matching aggregate figures. Both an **AI-response fixture** and a **503 fallback fixture** passed in all six viewport/language combinations. The OpenRouter service itself was not called for this verification.

The same fixture displayed simulated holdout error **0.89 orders/slot**, versus **2.06** for no-more-bookings, over **5,906** qualifying predictions on **14** held-out evenings, with **43** training evenings. [Exact results](validation.json). These validate simulated behavior, not real-world accuracy.

## Checks

- Lint, typecheck, final standalone production build, **117/117 unit tests**, **86/86 isolated PostgreSQL checks**; DB runner exited **0** without interruption.
- **43/43 full browser checks** passed. Final chart-label corrections were then exercised in the combined build's **34/34 focused checks**, covering all customer, vendor and manager journeys, six viewport/language pairs and reduced motion.
- Keyboard matrix navigation preserves the selected slot; native chart keyboard inspection and mouse/touch scrubbing agree. Closing a mobile row preserves its position. The selected row remains available after the replay closes booking. No horizontal overflow or browser page errors.
- Inspected the final 320/390 px charts and desktop KPI/matrix screenshots, and sampled the recording's prediction and outcome frames. The model's existing future-booking invariance, time-cutoff, sparse-history, closure and manager-only tests still pass.

## Production JavaScript

Same Windows host, Node 24.15.0, pnpm 11.24.0, locked dependencies and fixture public environment. Unique route entries plus route-local lazy imports, gzip level 9 per file. Build artifact sizes, not latency/transfer timings. Reproduce with `scripts/measure-route-js.mjs` after `pnpm build`.

| Route | Main baseline | This forecast PR | All three PRs together |
|---|---:|---:|---:|
| Menu | 108,396 B | 108,396 B | 109,108 B |
| Ticket | 111,868 B | 111,868 B | 112,918 B |
| Forecast including lazy dashboard | 123,817 B | 125,197 B | 126,119 B |

[Baseline](baseline-js.json) · [Standalone final](after-js.json) · [Combined build](combined-js.json). Menu and ticket manifests contain no forecast dynamic import. This PR adds **1,380 gzip bytes** to Forecast and zero to customer routes.

## Review handoff

The complete fourteen-component mapping is split across [customer PR19](https://github.com/YukonJR12/qafla/pull/19) (six), [vendor PR20](https://github.com/YukonJR12/qafla/pull/20) (three), and this PR (five). They merge locally without conflict and remain independently reviewable. PR15 submission work is untouched.

Not verified: physical-phone gestures, a live paid AI response, or live gateway payments. No Production deployment or order/payment creation was performed. Leave all three PRs open for visual approval.
