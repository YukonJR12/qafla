# Production verification — shared booking history

Verified 22 November 2026 on [Production](https://qafla-rjqd.vercel.app/manager?view=forecast), signed in as the park manager. Released commit: `53f593a409fbaa8a0973155bb04682edf9ed05b0` (PR #18; PR #17 was merged earlier). Vercel deployment `dpl_yXdzJn49zSd4zq8hJyz3tPXp55Cj` is READY and owns the Production alias.

Browser: ChatGPT in-app Chromium on Windows, responsive viewport overrides **320 × 844** and **390 × 844**. These are browser emulation checks, not physical-phone testing. A desktop scrollbar occupied 15 px; document width equalled client width in all four language/viewport combinations. This walkthrough was read-only after the separately documented owner-authorized fixture import. No orders, payments, capacity changes or closures were created through the UI.

## Shared counts

On 22 November, **Dune Burgers (T02), 5:00 PM** showed **2 of 6** in both Live Overview and Forecast. At the observed 4:50 PM clock, its 4:45 PM booking cutoff had passed; Forecast correctly showed booking closed, zero additional bookings and a 2–2 range. [Overview capture](live-overview-en-390.jpg) · [Forecast capture](forecast-count-match-en-390.jpg).

The separate [database audit](../database-audit.json) verified all **144/144** current occupancy cells against `slot_usage`. That aggregate check is distinct from the personally observed browser example above.

## Replay and AI explanation

Replay service date: **21 November**. Selected slot: **Taco Saha (T03), 8:00 PM**. At **7:00 PM**: **5 of 6 booked**, **1 additional booking expected**, projected **6 of 6**, range **5–6**. The next-hour KPI cards showed **9 slots at risk**, **35.3 expected new bookings**, and **8:00 PM / 32.3 of 43 places** as the busiest window.

Selecting **Generate AI forecast** produced **AI-powered explanation** in each language/viewport check; the generated explanation appeared, not the deterministic fallback. English identified the projected 6 reaching capacity 6. Arabic also stated current 5, one expected additional booking, range 5–6 and 45 minutes until cutoff. All cited numbers matched the selected slot. Provider implementation remains OpenRouter; no provider name is shown in the customer-facing label. Exact rendered text is retained in [observations.json](observations.json).

At **7:46 PM**, after the slot's **7:45 PM** cutoff, the comparison showed **original prediction 6 / actual final count 6 / absolute error 0 orders**. Rewinding to **7:00 PM** restored identical detail text and the cached generated explanation in all four checks. The dated **Booking history** header and replay controls stayed visible while scrolling. The fallback remains explicitly titled **Booking-based explanation** when no generated explanation has been requested for a selection.

| Check | Dashboard | Generated explanation | Original versus actual |
| --- | --- | --- | --- |
| English, 390 px | [Capture](dashboard-en-390.jpg) | [Capture](ai-en-390.jpg) | [Capture](comparison-en-390.jpg) |
| English, 320 px | [Capture](dashboard-en-320.jpg) | [Capture](ai-en-320.jpg) | [Capture](comparison-en-320.jpg) |
| Arabic, 390 px | [Capture](dashboard-ar-390.jpg) | [Capture](ai-ar-390.jpg) | [Capture](comparison-ar-390.jpg) |
| Arabic, 320 px | [Capture](dashboard-ar-320.jpg) | [Capture](ai-ar-320.jpg) | [Capture](comparison-ar-320.jpg) |

Controls and explanation text were reachable at both widths, with no observed horizontal overflow. A Vercel error/fatal runtime-log query for the released deployment returned no matching entries in the 13:38–13:53 UTC window.

## Provenance and scope

The stored history is seeded demo data, not real customer demand. The import and its limits are documented in the [parent evidence](../README.md). These Production observations establish that the released UI reads the shared data, generates matching explanations, and replays stored outcomes consistently. They do not establish real-world forecast accuracy. The existing normal-speed [mobile replay](../mobile-replay.webm) uses a controlled local database-response fixture; the screenshots and text in this folder are from Production.
