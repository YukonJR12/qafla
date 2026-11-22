# Rush Forecast — decision record

## Customer problem

Dana already sees booked occupancy. Rush Forecast asks which kitchen to check next, before the remaining pickup places fill. It is an advisory mode beside the existing Park overview; it never changes capacity, closes a truck or writes an order.

## Model and observable information

A seeded generator (20261122) creates 57 service evenings, beginning 27 September 2026, for the six seeded trucks and all 24 quarter-hour pickup windows. Booking and cancellation times are Kuwait minutes within a named service date. It models truck-specific dinner peaks, Thursday/Friday evening pressure, occasional quiet nights, successful-booking caps and closures. All synthetic data lives in memory outside Supabase. The demo is Sunday 22 November; Saj closes at 19:10 in this simulated evening.

At each cutoff the model only counts bookings made by then, excluding cancellations/rejections only when their event is already known. Comparable evenings must precede the target day, use the same truck/slot/evening group, and remain open through that slot's cutoff. We choose up to 12 with the nearest known booking count (recent evenings break ties). Their mean remaining successful bookings is added to the current count and capped at capacity. The empirical 10th–90th percentile supplies a likely range; fewer than five comparables displays Limited history. These are successful bookings, not an estimate of unobserved demand after a sell-out. Future bookings and future cancellations cannot alter an earlier prediction.

The existing app rule allows booking exactly 15 minutes before pickup and closes it immediately afterwards. Full, cutoff-closed and truck-closed slots are distinct. The next-hour KPIs exclude all three, share one replay clock and include only pickup times within the next 60 minutes. Risk means room now with a range reaching capacity; ranking uses comparable fill share, earliest cutoff, projected occupancy, then truck ID. The busiest window is the highest projected proportion of still-bookable capacity. Counts and denominators are displayed, not percentages alone. “Check now, before cutoff” is an inspection recommendation, not a kitchen preparation estimate.

## What OpenRouter contributes

The statistical model calculates every number. OpenRouter selects and explains the strongest aggregate signal in English or Arabic. The server verifies the Supabase user and manager profile, accepts only an allowlisted truck/slot/replay/language selection, recomputes the aggregates, and sends no orders, identities or credentials. It reuses the existing server-only OpenRouter configuration. Bounded response caching reduces repeat calls. A timeout, missing key, provider failure, truncated output or unsupported numeric claim returns a deterministic bilingual explanation; none of these prevents use of the forecast. Text is rendered as text, not HTML. Automated tests cover the HTTP role boundary and fallback; the real-provider smoke record covers both languages with real read-only manager authentication.

## What validation establishes

The first 42 evenings train the model. The latest 14 are held out entirely; each eligible truck/slot is replayed at 90, 60 and 30 minutes before pickup. Both models use the same 5,940 slot/cutoff observations. Mean absolute error: **0.8972 orders per slot** for the forecast versus **2.0601** for “no more bookings.” Outcomes are evaluated at booking cutoff, not service completion. Repeated cutoffs on a slot are correlated; this is not 5,940 independent evenings. The remaining 57th evening is the interactive demo, not a held-out score example.

This verifies arithmetic and as-of behavior on simulated history, not live demand accuracy or calibrated interval coverage. The app does not yet connect an audited longitudinal live booking-event history; it says live forecasting is unavailable and offers the labelled demo. Real occupancy stays live in Overview. Before a live rollout, validate status-event history, comparable definitions, capacity changes, interval coverage and drift against real held-out evenings. Phone checks are Chromium emulation, not physical-device testing.
