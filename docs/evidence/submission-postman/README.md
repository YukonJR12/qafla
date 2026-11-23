# Latest authenticated Postman evidence — 22 November 2026

**32 requests, 63 passing assertions, zero failed requests/assertions**, across three runs, not one 32-request run. [Per-request ledger](request-ledger.md) · [counts, request hashes and original-log hashes](reconciliation.json) · [empty example environment](authenticated-example.environment.yaml). All 32 saved request YAML files are linked in the ledger.

| Run | Requests | Passing assertions | Retained artifact |
| --- | --- | --- | --- |
| Checkout | 16 | 31 | postman-checkout.log |
| Real AI draft | 7 | 14 | postman-ai.log |
| Payment completion | 9 | 18 | postman-payment-completion.log |

The original logs remain in the owner's ignored .afk directory. Their successful summaries and Pass lines are retained; a shell exit code was not explicitly saved. Earlier smoke-run summaries under .afk/postman-runs are a different collection and do not substantiate these 32/63 figures. No authenticated execution-response export was found: the ledger does not invent one.

## Targets and commit provenance

- **Qafla app URL tested:** http://127.0.0.1:3001 — local production build, not the public Vercel app.
- **Public Qafla app:** https://qafla-rjqd.vercel.app — current Production 8ed79b4, checked separately.
- **Gateway sandbox:** https://demo.myfatoorah.com — payment host, not Qafla. The owner-only invoice/payment URLs and identifiers are omitted. Source also permits the sandbox .com.kw host.
- **Database:** existing hosted Supabase project used by the demo; these runs created and cancelled two T06 test orders. Localhost here does not mean an isolated database.
- **Exact built app commit:** Pending/unknown. Root checkout HEAD is 56f4e9d and has local changes; the retained build log does not bind the binary to a clean commit. Do not relabel this as Production 8ed79b4 or the isolated race build. Saved YAML is pinned by hashes in the reconciliation manifest.

## What the saved assertions establish

Checkout placed one pay-at-pickup and one online T06/M601 order at the saved menu price. A retry returned the same pickup order; saved line quantity and unit price matched. The pickup test order was cancelled (HTTP 200; returned status cancelled). Its assertion title says capacity released, but the actual assertion checks only status: no independent occupancy readback was retained in this latest run. Capacity-release behavior has separate isolated evidence.

The payment-start input deliberately supplied amount 0.001. The gateway page and saved invoice used the saved **1.200 KWD** order total. Creating/reopening the same invoice left the order unpaid; vendor acceptance returned HTTP 400 payment_not_confirmed. A later real sandbox settlement is recorded by the local server as PAID/SUCCESS, 1.2 KWD. Repeated verification returned HTTP 200 paid twice. Both notification requests returned HTTP 200 {received:true}; the following saved-state reads showed a paid timestamp and **exactly one paid invoice**, currency KWD. This substantiates duplicate handling, not a real-money charge.

The online test order was then cancelled (HTTP 200; status cancelled). The final GET assertion verifies **status cancelled, payment_status refund_due**. **No refund-issued transaction or gateway refund receipt is evidenced. Refund due is the final observed state.** Neither cancellation was re-executed for this packaging task.

## Real OpenRouter draft and unchanged saved menu

Customer suggestion request returned HTTP 401; a vendor request without a valid photo returned HTTP 400. The T06 vendor then submitted M601 plus a real dish photo: HTTP 200 with a bounded description and allowlisted allergens. Retained local server log: ai_suggest_ok, reference 4b4694a8, model anthropic/claude-haiku-5.5, 5,151 ms, 3 allergens. The exact draft wording was not retained in these CLI logs. Before and after GETs compare the complete selected M601 object (ID, truck, price, description, allergens, sold_out) using deep equality. Thus generating the draft left that saved dish unchanged; it does not prove a fresh all-30-dish comparison. The separate [injection-card run](../ai-menu/injection-card-local.md) supplies that all-30 comparison.

This evidence supports payment and AI behavior. It does not close the manual Production attempts 1–5 or signed-in secret inspection. Sending a small payment amount to payments/start is not PDF attempt 1a (forging a menu item's placement price), and 401 from an AI route is not the cross-account order-read test.
