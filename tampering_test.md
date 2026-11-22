# Tampering Test — evidence inventory, not a completed live report

Candidate: Faisal Alrefae. Live app: https://qafla-rjqd.vercel.app
Deadline: Monday, 23 November 2026, 11:59 PM Kuwait time (UTC+3).
Audit date: 22 November 2026. No Production attack orders or payments. The five-round race ran only in disposable PostgreSQL. Five vendor demo accounts and their assignments were added on Faisal's explicit request.

The assessment requires direct requests on the live deployment and a data-after check for every attempt. Passing isolated database tests is supporting evidence, not a substitute. The original blank form remains in templates/tampering_test.md.

| Required live check | Observed result / provenance | Resulting data | Screenshot | Pending live observation |
| --- | --- | --- | --- | --- |
| 1 Price/quantity tampering | Isolated tests validate database pricing and quantity refusals; no packaged live request found | Live before/after data **pending** | **Pending** | Sanitized direct request, response and saved-price/unchanged-count proof |
| 2 Illegal transitions | Historical Preview T02 vendor: direct accept returned `400 payment_not_confirmed`; placed→ready returned `400 transition_not_allowed` ([step 11](docs/evidence/payments/preview-sandbox-run.md)) | T02-000054 remained placed/unpaid at that step; later legitimately cancelled | [Vendor cannot accept](docs/evidence/payments/preview-14-failed-vendor-cannot-accept.jpg); this shows UI, not the direct response | Customer accepted/collected attempts; direct-response screenshot and complete request capture. Historical vendor observation is partial, not a completed check |
| 3 Cross-account reads | RLS and isolated tests only; required customer A/B and T02/T06 logins now verified | Live forbidden-row read result **pending** | **Pending** | Direct customer-other-order and vendor-other-truck requests with privileged comparison of the real row |
| 4 Full/closed slot | Current isolated browser race: five `slot_full` refusals; historical closure tests are local | Each isolated slot stayed at 6 orders after two competing requests; +1 only ([results](docs/evidence/submission-race/results.json)) | [Slot-full recovery](docs/evidence/submission-race/round-1-a-after.png), **isolated** | Direct live full/closed request and live data-after count; browser fixture is supporting evidence |
| 5 Role promotion | Profile grants/RLS and isolated tests only | Live unchanged-role result **pending** | **Pending** | Direct profile update request, response and saved-role readback |
| 6 Secret search | Source uses server-only OpenRouter/payment settings; no complete live bundle/network capture found | Live scan manifest and match results **pending**; code architecture alone proves no deployed absence | **Pending** | Search deployed client bundles and relevant network traffic for OpenRouter, service-role and gateway secrets; record sanitized results |

Enforcing source: checks 1/4 use `place_order` in the order-functions/request-id/abandon-order-attempt migrations; check 2 uses `set_order_status` and the online-payments migration; checks 3/5 use `20261118190100_access_rules.sql`. Check 6's server routes are `app/api/menu/suggest/route.ts` and `app/api/payments/*`; service-role credentials are not required by this app's runtime. These references explain the intended rules, not a claim that missing live attempts passed.

| Additional check | Evidence | Limit |
| --- | --- | --- |
| 7 Fake payment success | [Preview sandbox write-up](docs/evidence/payments/preview-sandbox-run.md), [local write-up](docs/evidence/payments/local-sandbox-run.md) | Historical results; not rerun on current Production; gateway-key client scan still pending |
| 8 Last-slot race | [Two-session five-round recording and data](docs/evidence/submission-race/README.md) | Completed on isolated real PostgreSQL with auth/HTTP adapter; submitted-live-link run pending |

## Attempt 7 — inherited result

The Preview payment write-up records forged return values before payment and an unrelated paid order's payment ID. The target stayed unpaid and the other order stayed paid. It separately records real sandbox settlement, repeat-return idempotency, pay-at-pickup, failed payment and refund_due. Use that original write-up for ticket IDs, responses, database observations and screenshots; do not relabel it as a current Production run.

## Completion record required for attempts 1–6

For each attempt, record: account role and truck; timestamp and exact deployment; HTTP method, URL and sanitized body; status and response; query/screenshot proving data afterwards; enforcing policy/function with source file; screenshot filename. Remove bearer tokens, cookies, credentials and secret values. A successful HTTP response with zero changed rows may still be a correctly blocked write.

## Five-round race — completed isolated exercise

Two independent Chromium contexts submitted together against disposable PostgreSQL using the real migrations and seed. All five rounds yielded one confirmed ticket and one slot-full recovery; counts went from 5 to 6, never 7. The HTTP adapter releases both placement queries together; PostgreSQL's truck-row lock and count recheck choose the winner. Success and refusal are real database results, not mocked outcomes. [Setup, recording, per-round screenshots and data](docs/evidence/submission-race/README.md).

Preview shares Production's database. The authorized isolated run creates no hosted orders or payments. Because the assessment explicitly asks for the live link, obtain CODED's acceptance of this setup or rerun on a dedicated deployed test database. Do not label the local recording as Production evidence. All five required live demo logins are now verified; repository invitation/attachment delivery is still outstanding.

## Other Elite evidence

- [Injection card result](docs/evidence/ai-menu/injection-card-local.md): real OpenRouter on a local production build; draft only, all 30 dishes unchanged. Not a Production run.
- [Forced-error screenshot](docs/evidence/ai-menu/forced-error-preview.jpg) and [log](docs/evidence/ai-menu/forced-error-preview-log.txt): Preview missing-key failure; matching reference 238caf74.
- README, env example, migrations and seed script are present; a new TA's clean setup rehearsal remains unverified.

## What surprised me

Pending Faisal's own account of an attack that initially failed to be blocked, if one occurred. Do not invent a security failure to fill the template. The honest recorded AI/payment debugging stories are in decisions.md.
