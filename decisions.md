# Qafla — decisions

Candidate: Faisal (confirm full submission name). Repository: https://github.com/YukonJR12/qafla
Prepared from shipped source and recorded evidence, 22 November 2026. Candidate must review and be able to explain these decisions.

## Customer problem: recognizing the pickup counter

Someone arriving at a six-truck park needs to recognize their pickup counter before walking over. A name in a ticket is less helpful than a recognizable truck. The shipped 3D Park Guide gives each seeded truck its own branding, colour and silhouette in a small entrance-facing plaza. Customers can rotate the park, select a truck and see its menu/availability sheet. A Ready ticket opens the correct model using the confirmed truck ID; a truck paused for new orders is still locatable by customers collecting an existing order.

Physical positions do not mirror in Arabic: the park is the same place, while controls and labels localize. A searchable list supports keyboard access and WebGL failure. Three.js loads only when Map opens, geometry/materials are reused and demand rendering stops once motion settles. Reduced motion skips camera animation.

The [14.6-second recording](docs/screenshots/park-3d/park-interaction-390-en.webm) already verifies Ready → T02 using a controlled fixture; no new order was needed. The recorded route starts at Account → Map. Production Explore → Map was separately checked. All phone checks were Chrome emulation at 320/390 px in EN/AR. Physical-device pinch smoothness is unverified; 1.62 seconds is the local recorded load, not a handset benchmark.

## Tables and relationships

| Table | One row / key relationship |
| --- | --- |
| profiles | Auth user ID, role and display name; manager role assigned in database |
| trucks | Seeded T01–T06; unique assigned vendor, capacity and open state |
| menu_items | Seeded dish belonging to one truck; current price, sold-out state, description/allergens |
| truck_closures | Truck and service date closed by the manager |
| orders | Customer, truck, service date, pickup slot, state, saved total and payment state |
| order_items | Order line with dish/name/price snapshot and quantity |
| order_ratings | One rating per collected order |
| ai_suggestion_requests | Vendor suggestion requests used to enforce the hourly limit |
| order_payments | Gateway invoice/payment attempts linked to an order |
| private.abandoned_requests | Checkout attempts explicitly abandoned, preventing a late duplicate order |
| private.server_keys | Hash used to authenticate the payment settlement server; not client-readable |

See [schema](supabase/migrations/20261118190000_schema.sql) and later migrations for exact constraints.

## Derived values and concurrency

Free places are capacity minus qualifying orders, not a stored counter. Every state counts except rejected and cancelled, including collected. This returns capacity immediately after cancellation/rejection without counter drift. Order placement locks the truck row before checking availability and inserting; serialized competing requests recheck the count. The two-connection database test exercises five last-place races, but it is not the required two-browser recording.

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

[.env.example](.env.example) contains names and empty values. This code/config review is not a completed live bundle/network secret scan.

## What did not work — candidate review required

1. Earlier Preview AI calls had missing OpenRouter configuration. The vendor saw a recoverable message preserving edits and a reference matching a server log; a later configured Preview produced a suggestion. [Missing-key evidence](docs/evidence/ai-menu/forced-error-preview-log.txt), [successful run](docs/evidence/ai-menu/preview-run-log.txt). Faisal should explain his own debugging steps rather than claim a story he did not perform.
2. The first attempted cancelled-payment demo actually settled as paid; another remained pending. A later bank-page cancellation produced a verified failed transaction, left the order unpaid and prevented vendor acceptance. The evidence distinguishes cancellation from a declined card. [Run and corrections](docs/evidence/payments/preview-sandbox-run.md).

## Levels and limits

Core/Premium features and the Park Guide are shipped. Existing AI/payment evidence includes local and Preview runs. Full assessment completion is not claimed until the five demo logins, live tampering write-up and two-browser race recording are packaged. Notifications are not implemented; the guide does not depend on them. See [submission audit](submission.md).
