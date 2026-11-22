# Shared booking data and AI forecast wording

[Mobile replay](mobile-replay.webm) · [320 Arabic](320-ar-dashboard.png) · [390 English](390-en-dashboard.png) · [Desktop](1440-en.png)

This follows the owner's request to treat the entire Qafla deployment as a populated demo. Synthetic records are stored in the same order tables as the original test orders, marked `fixture_batch = rush-demo-v1` and assigned to a dedicated fixture customer with no sign-in credentials. They are generated test fixtures, not real purchases or evidence of genuine demand. The product shows **Booking history** with the service date; this evidence retains provenance.

Forecast now opens **Live today** using database time and the same order counts as Overview. Its manager-only RPC returns aggregate booking timestamps, cancellation timestamps and capacities without customer IDs, names, ticket references or payment details. A separate dated **Replay the evening** uses the latest completed service date. It cannot reveal future bookings at an earlier cutoff.

**Generate AI forecast** requests a short explanation of the statistical model. A successful provider response is titled **AI-powered explanation**. The provider stays server-side; unavailable output remains clearly titled **Booking-based explanation**. The language model does not change the prediction or write orders.

## Verification

- Lint, typecheck and production build passed.
- 117 unit tests passed, including time selection, cutoff behavior and no future-booking/cancellation leakage.
- 86 database checks passed and the process exited 0. New checks deny anonymous/customer/vendor history access, compare all current slot counts against `slot_usage`, and prove a future-dated order cannot alter an earlier database snapshot.
- The importer ran twice against an isolated database: the second import added no duplicates; no future placements or payment records were created; forecast and occupancy matched. Truck locks serialize imports with ordinary checkout. Existing tickets are never updated.
- 43 browser tests passed, including English/Arabic at 320, 390 and 1440 px, keyboard replay, touch selection, matching KPIs/chart/details and provider fallback. Chromium on Windows with responsive/touch emulation; no physical-device claim.
- The local clip uses an intercepted database response, not the shared Production database. It represents the latest completed evening as 22 November and the current service date as 23 November to keep the test deterministic. The statistical model and UI are the implementation under review.

The earlier PR #17 Production check is retained [separately](../rush-forecast/production/README.md); its repeated demo label and OpenRouter wording describe that earlier build.

## Import and limits

Imported on 22 November 2026: **29,113 historical orders and 36 upcoming orders**, six upcoming orders per truck; **67 existing orders preserved**. Four generated closures are historical only. The follow-up dry-run proposes zero additional records. [Database audit](database-audit.json) confirms **all 144 current occupancy cells match** and **zero fixture payment records**. Backtest on the stored dataset: **0.8984 orders/slot** average error versus **2.0625** for no-more-bookings, using **5,936 predictions**, 42 training and 14 held-out evenings.

The importer defaults to dry-run. `--apply` is an owner-only operation using the private database URL. It imports eight prior weeks and a sparse spread of upcoming orders, preserves at least two free places in each newly populated upcoming slot, and uses pay-at-pickup/unpaid without gateway calls. Existing tickets and truck settings are preserved; generated closures are historical only. Run again on another demo date explicitly if it needs fresh upcoming fixtures; there is no automatic order creation.

The database-backed backtest uses the latest 14 completed evenings as holdout and all preceding available evenings for training (up to 56 completed dates total). Seeded accuracy does not establish real-world accuracy. Historical capacity uses the current truck setting because the app does not yet store capacity-change history. Terminal cancellation/rejection timestamps come from `updated_at`; richer operational event history should be audited before using this outside the demo.
