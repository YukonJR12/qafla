# Tampering Test — evidence inventory, not a completed live report

Candidate: Faisal (confirm). Live app: https://qafla-rjqd.vercel.app
Audit date: 22 November 2026. No attacks, orders, payments or database writes were performed for this audit.

The assessment requires direct requests on the live deployment and a data-after check for every attempt. Passing isolated database tests is supporting evidence, not a substitute. The original blank form remains in templates/tampering_test.md.

| Attempt | Existing evidence | Submission status |
| --- | --- | --- |
| 1 Price/quantity tampering | tests/db/run.mjs validates server pricing and quantity refusals | Missing packaged live method/URL/body, response, data-after proof and screenshot |
| 2 Illegal transitions | Database tests; historical unpaid vendor rejection requests in payment write-up | Missing complete live customer accepted/collected and vendor placed→ready evidence |
| 3 Cross-account reads | RLS code and isolated tests | Missing live customer A/B and vendor T02/T06 direct-read captures |
| 4 Full/closed slot | Isolated capacity and closure tests, customer recovery screenshots | Missing direct live request plus data-after proof |
| 5 Role promotion | Profile grants/RLS and tests | Missing live profile tampering request/response and unchanged-role proof |
| 6 Secret search | Server-only env names and code architecture | Missing live client bundle/network scan documenting OpenRouter and service-role key absence |
| 7 Fake payment success | [Preview sandbox write-up](docs/evidence/payments/preview-sandbox-run.md), [local write-up](docs/evidence/payments/local-sandbox-run.md) | Historical results usable with provenance; not rerun on current Production; gateway-key client scan still missing |
| 8 Last-slot race | Five-round two-connection test in tests/db/run.mjs | **Required two-browser, five-round recording absent from submission files** |

## Attempt 7 — inherited result

The Preview payment write-up records forged return values before payment and an unrelated paid order's payment ID. The target stayed unpaid and the other order stayed paid. It separately records real sandbox settlement, repeat-return idempotency, pay-at-pickup, failed payment and refund_due. Use that original write-up for ticket IDs, responses, database observations and screenshots; do not relabel it as a current Production run.

## Completion record required for attempts 1–6

For each attempt, record: account role and truck; timestamp and exact deployment; HTTP method, URL and sanitized body; status and response; query/screenshot proving data afterwards; enforcing policy/function with source file; screenshot filename. Remove bearer tokens, cookies, credentials and secret values. A successful HTTP response with zero changed rows may still be a correctly blocked write.

## Five-round race plan — pending authorization and credentials

Use two separate signed-in customer browser contexts against a real isolated database deployment. For each of five rounds, show one remaining place, submit simultaneously, show exactly one success and one full-slot refusal, then verify the final qualifying order count equals capacity. Record both browser windows and retain a round-by-round table of slot, before count, winner/loser and after count. Explain the truck-row lock and server count recheck. Do not use mocked success responses as race evidence.

Preview shares Production's database. No repeat order tests were authorized in this submission-preparation task. Faisal needs to confirm the disposable test setup and whether CODED accepts an isolated deployment for evidence intended for the live link. The panel will still need working accounts on the submitted live app.

## Other Elite evidence

- [Injection card result](docs/evidence/ai-menu/injection-card-local.md): real OpenRouter on a local production build; draft only, all 30 dishes unchanged. Not a Production run.
- [Forced-error screenshot](docs/evidence/ai-menu/forced-error-preview.jpg) and [log](docs/evidence/ai-menu/forced-error-preview-log.txt): Preview missing-key failure; matching reference 238caf74.
- README, env example, migrations and seed script are present; a new TA's clean setup rehearsal remains unverified.

## What surprised me

Pending Faisal's own account of an attack that initially failed to be blocked, if one occurred. Do not invent a security failure to fill the template. The honest recorded AI/payment debugging stories are in decisions.md.
