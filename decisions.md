# Qafla Pickup — decisions

Candidate: Faisal Alrefae. Repository: https://github.com/YukonJR12/qafla
Submission deadline: Monday, 23 November 2026, 11:59 PM Kuwait time (UTC+3).
Prepared from shipped source and recorded evidence, reconciled with Production 8ed79b4 (PRs #19–21 merged), 22 November 2026. Candidate must review and be able to explain these decisions.

## Customer problem: recognizing the pickup counter

Someone arriving at a six-truck park needs to recognize their pickup counter before walking over. A name in a ticket is less helpful than a recognizable truck. The shipped 3D Park Guide gives each seeded truck its own branding, colour and silhouette in a small entrance-facing plaza. Customers can rotate the park, select a truck and see its menu/availability sheet. A Ready ticket opens the correct model using the confirmed truck ID; a truck paused for new orders is still locatable by customers collecting an existing order.

Physical positions do not mirror in Arabic: the park is the same place, while controls and labels localize. A searchable list supports keyboard access and WebGL failure. Three.js loads only when Map opens, geometry/materials are reused and demand rendering stops once motion settles. Reduced motion skips camera animation.

The [14.6-second recording](docs/screenshots/park-3d/park-interaction-390-en.webm) already verifies Ready → T02 using a controlled fixture; no new order was needed. The recorded route starts at Account → Map. Production Explore → Map was separately checked. All phone checks were Chrome emulation at 320/390 px in EN/AR. Physical-device pinch smoothness is unverified; 1.62 seconds is the local recorded load, not a handset benchmark.

The submission includes the [five-round isolated PostgreSQL race](docs/evidence/submission-race/README.md) and [five required panel logins on the current Production build](docs/evidence/submission-final-access/README.md). No vendor account remains missing. The local race is supporting evidence, not a live-deployment assessment run.

## Tables and relationships

| Table | One row / key relationship |
| --- | --- |
| profiles | Auth user ID, role and display name; manager role assigned in database |
| trucks | Seeded T01–T06; unique assigned vendor, capacity and open state |
| menu_items | Seeded dish belonging to one truck; current price, sold-out state, description/allergens |
| truck_closures | Truck and service date closed by the manager |
| orders | Customer, truck, service date, pickup slot, state, saved total/payment state; fixture_batch identifies imported simulated history |
| order_items | Order line with dish/name/price snapshot and quantity |
| order_ratings | One rating per collected order |
| ai_suggestion_requests | Vendor suggestion requests used to enforce the hourly limit |
| order_payments | Gateway invoice/payment attempts linked to an order |
| private.abandoned_requests | Checkout attempts explicitly abandoned, preventing a late duplicate order |
| private.server_keys | Hash used to authenticate the payment settlement server; not client-readable |

See [schema](supabase/migrations/20261118190000_schema.sql) and later migrations for exact constraints.

## Derived values and concurrency

Free places are capacity minus qualifying orders, not a stored counter. Every state counts except rejected and cancelled, including collected. This returns capacity immediately after cancellation/rejection without counter drift. Order placement locks the truck row before checking availability and inserting; serialized competing requests recheck the count. The [recorded five-round exercise](docs/evidence/submission-race/README.md) uses two independent browser sessions and two real PostgreSQL connections; each slot goes from 5/6 to 6/6, with one winner. It is isolated, not the live deployment.

The server calculates totals from menu prices, then saves line-price/name snapshots so later menu edits cannot alter an existing order. Cart totals are previews. Request IDs make retries idempotent; pending attempts are reconciled before checkout offers another order. Payment choice is explicit and stored with the account's local cart; it does not itself create an order or charge a card.

## Access rules

| Data/action | Allowed actor and enforcement |
| --- | --- |
| profiles read | Self or manager through profiles_select RLS |
| profiles role update | No ordinary client UPDATE grant; manager provisioned administratively; set_my_name changes only display name |
| trucks/menu read | Public SELECT policies; app still gates navigation by login |
| trucks/menu edit | Assigned vendor only via ownership RLS, limited grants and validated functions; cannot claim another truck |
| orders/order_items read | Owner customer, assigned vendor or manager; child rows inherit parent visibility |
| orders insert / state updates | Controlled functions validate role, ownership, time, capacity, item IDs/quantities and transitions; no arbitrary client write path |
| closures write | close_truck_for_tonight checks manager role |
| rating write | rate_order checks customer ownership, collected state and uniqueness |
| AI draft/save | Server authenticates vendor; begin_ai_suggestion checks ownership and 20/hour limit; save_menu_copy permits description and approved allergens, never price |
| payment settlement | Server verifies gateway response and order amount/currency; private server-secret check protects settlement functions |
| forecast_history read / forecast explanation | Manager-only RPC and server role check; aggregates only, no customer identities; no order/capacity writes |
| destructive writes | No general customer/vendor DELETE path for transactional rows |

The UI route gate is convenience, not the security boundary. Inspect [RLS/grants](supabase/migrations/20261118190100_access_rules.sql), [order functions](supabase/migrations/20261119180000_abandon_order_attempt.sql), [AI rules](supabase/migrations/20261120200000_menu_ai.sql), and [payments](supabase/migrations/20261120230000_online_payments.sql).

## Order states

Placed → Accepted → Preparing → Ready → Collected is enforced by set_order_status. Assigned vendors advance or reject (with a reason); customers cancel only their own Placed orders. Online unpaid orders cannot be accepted. Paid rejected orders are marked refund_due; this is not an automatic gateway refund. Timeline previews change explanations only, never the confirmed badge/state or database.

## Secrets

| Value | Location / access |
| --- | --- |
| Supabase URL/publishable key | NEXT_PUBLIC variables; intentionally client-visible, RLS still applies |
| Supabase service-role key | Not required by the app's documented runtime configuration; do not add one to client code |
| OpenRouter key/model | Server environment; API route calls provider; key never belongs in a NEXT_PUBLIC variable |
| MyFatoorah key | Server environment, sandbox only |
| Payment server secret | Server environment; only its hash is provisioned in private.server_keys |

[.env.example](.env.example) contains names and empty values. The [signed-out Production scan](docs/evidence/submission-access/README.md) covers 12 loaded resources with no matching secret patterns; signed-in network and lazy-loaded bundle inspection is still pending. Source/config review alone does not establish deployed absence.

## Rush Forecast — shipped manager feature

### Customer problem

Dana already sees booked occupancy. Rush Forecast asks which kitchen to check next, before the remaining pickup places fill. It is an advisory mode beside the existing Park overview; it never changes capacity, closes a truck or writes an order.

### Shared booking history

The owner treats the whole Qafla deployment as a demo. At their request, the database now contains identifiable generated history alongside the original test tickets: eight weeks across six trucks, plus a small spread of upcoming pay-at-pickup orders. This is synthetic fixture data, not evidence of real demand. The importer uses a dedicated non-login fixture customer and an orders.fixture_batch marker; no existing customer's tickets are reassigned or overwritten. It runs separately from migrations, defaults to dry-run, is idempotent, locks trucks like checkout, preserves capacity and never calls a payment gateway. Historical fixture closures apply only to past dates.

Forecast now reads timestamped aggregates from the same public.orders rows as Park overview. A manager-only RPC returns no identities, tickets, emails or prices. Today opens at the database clock; the dated replay uses the latest completed evening, so it never pretends a past snapshot is tonight. Cancellation/rejection uses the saved terminal-status updated_at; other status changes still consume capacity. Zero-booking days between the first available record and today are retained. Current truck capacity is used for historic comparisons because the app has no capacity-change audit; validate or add that audit before using historical intervals for real operations.

The shipped UI keeps “Demo forecast · simulated history” and the service date visible, including replay. The submission and fixture ledger retain provenance. The AI action is Generate AI forecast and its successful response is AI-powered explanation; the fallback remains explicitly booking-based. These label changes do not transfer numerical prediction to the language model.

At each cutoff the model only counts bookings made by then, excluding cancellations/rejections only when their event is already known. Comparable evenings must precede the target day, use the same truck/slot/evening group, and remain open through that slot's cutoff. We choose up to 12 with the nearest known booking count (recent evenings break ties). Their mean remaining successful bookings is added to the current count and capped at capacity. The empirical 10th–90th percentile supplies a likely range; fewer than five comparables displays Limited history. These are successful bookings, not an estimate of unobserved demand after a sell-out. Future bookings and future cancellations cannot alter an earlier prediction.

The existing app rule allows booking exactly 15 minutes before pickup and closes it immediately afterwards. Full, cutoff-closed and truck-closed slots are distinct. The next-hour KPIs exclude all three, share one replay clock and include only pickup times within the next 60 minutes. Risk means room now with a range reaching capacity; ranking uses comparable fill share, earliest cutoff, projected occupancy, then truck ID. The busiest window is the highest projected proportion of still-bookable capacity. Counts and denominators are displayed, not percentages alone. “Check now, before cutoff” is an inspection recommendation, not a kitchen preparation estimate.

### What OpenRouter contributes

The statistical model calculates every number. OpenRouter selects and explains the strongest aggregate signal in English or Arabic. The server verifies the Supabase user and manager profile, accepts only a recorded truck/slot/date/time/language selection (no future live time and only the latest completed replay), recomputes the aggregates, and sends no orders, identities or credentials. It reuses the existing server-only OpenRouter configuration. Bounded response caching reduces repeat calls. A timeout, missing key, provider failure, truncated output or unsupported numeric claim returns a deterministic bilingual explanation; none of these prevents use of the forecast. Text is rendered as text, not HTML. Automated tests cover the HTTP role boundary and fallback; the real-provider smoke record covers both languages with real read-only manager authentication.

### What validation establishes

The latest retained [simulated validation](docs/evidence/easyui-forecast/validation.json) reports **0.8923 orders per slot** average absolute error versus **2.0552** for the “no more bookings” baseline: **5,906 slot/cutoff observations**, 14 held-out evenings and 43 training evenings. Each eligible slot is replayed at 90, 60 and 30 minutes before pickup. Outcomes are evaluated at booking cutoff, not service completion. Repeated cutoffs are correlated; these are not 5,906 independent evenings. These measured results came from the recorded local combined-build fixture, not genuine customer demand.

The earlier PR #17 generator benchmark (5,940 predictions, MAE 0.8972 versus 2.0601) remains historical evidence; it uses a different dataset from the retained figures above. The operational dashboard now recalculates its backtest from completed database evenings, holding out the latest 14 and excluding today. Seeded results verify arithmetic and as-of behavior, not real demand accuracy or calibrated interval coverage. Before real use, validate status-event and capacity-change history, interval coverage and drift against genuine held-out evenings. Phone checks are Chromium viewport emulation, not physical-device testing.


The [deployed Preview replay](docs/evidence/preview-approval-19-21/README.md), on code now included in Production, selected Taco Saha at 8:00 PM: at 7:00 PM, 5/6 booked, projection 6 and range 5–6; final simulated count 6, error 0. Rewind restored the same KPIs, heatmap, chart and expanded row. No OpenRouter call was made in that check. Earlier [Production OpenRouter observations](docs/evidence/rush-forecast/production/README.md) are separately dated and preceded the shared-history change.

## Payment settlement and vendor draft review

The browser's success query and payment amount are untrusted. The server authenticates the customer and ownership, fetches gateway status, matches the gateway invoice/order reference, currency and saved amount, and invokes protected settlement. Invoice creation alone remains unpaid; only verified gateway payment sets paid/paid_at. Repeated returns and callbacks reconcile the same invoice idempotently. Paid cancellation or rejection records refund_due; issuing a refund is an operational step, not an observed automatic action. [Latest 1.200 KWD sandbox check and duplicate handling](docs/evidence/submission-postman/README.md) ran on localhost with the hosted database, exact built commit unknown. Final saved state is cancelled/refund_due, with no refund receipt.

A vendor explicitly chooses a photo, asks for a suggestion, then chooses whether to use it. Applying a draft fills editable description/allergens and resets allergen confirmation; the vendor checks the recipe, edits and confirms before Save for customers. Provider output is reduced to bounded text and allowlisted allergens. The save RPC permits only those fields for the assigned truck. A suggestion cannot change price, availability or saved menu by itself. [Real-model before/after check](docs/evidence/submission-postman/README.md) verifies M601 unchanged; [Preview 3bfd786 workflow](docs/evidence/ai-menu/preview-run-log.txt) and [controlled current review UI](docs/evidence/easyui-vendor/README.md) cover edit/confirm/save separately.

## What did not work — candidate review required

1. **AI Preview configuration:** the attempted photo generation failed because Preview lacked OpenRouter settings. The UI preserved edits and displayed reference 238caf74. Matching server logs identified stage=configuration and the missing variable; a later configured Preview (3bfd786) returned a real draft. The change was Preview environment configuration and a new deployment, not removal of the error guard. [Missing-key evidence](docs/evidence/ai-menu/forced-error-preview-log.txt), [successful run](docs/evidence/ai-menu/preview-run-log.txt). Faisal should explain his own debugging steps rather than claim a story he did not perform.
2. **Payment cancellation diagnosis:** an intended cancelled-payment demo actually settled as paid; another attempt remained pending with no transaction. Gateway status and database readbacks exposed the mismatch with the intended test. The next test was changed to cancel on the bank page itself, then verify the gateway Failed/MF006 transaction, unpaid saved order and vendor acceptance refusal. This was a correction to the test procedure; no payment-code fix is evidenced. The evidence distinguishes bank-page cancellation from a declined card. [Run and corrections](docs/evidence/payments/preview-sandbox-run.md).

## Levels and limits

Core/Premium features and the Park Guide are shipped. All required demo logins are now verified, including vendors for all six trucks, and the two-browser five-round race is packaged with real isolated PostgreSQL results. Existing AI/payment evidence includes local and Preview runs. Full assessment completion is not claimed: the pending live observations in tampering_test.md, acceptance or live rerun of the isolated race, and an independent new-TA setup rehearsal remain outstanding. An offline evidence package removes the private-link barrier for attachments; panel GitHub access is still needed to review the full repository. Notifications are not implemented; the guide does not depend on them. See [submission audit](submission.md).

## Candidate voice and provenance

No claim here that Faisal personally ran an assistant-driven test is implied. **Faisal confirmation required before converting either debugging story to “I tried / I diagnosed / I changed”.** The baseline screenshot is the only supplied manual attempt-1 capture credited to him, and supports the menu baseline/cancelled attempt only. Authorship of implementation choices, personal debugging steps, understanding of every decision and onboarding availability require his review. Historical evidence notes retain their original actor descriptions.
