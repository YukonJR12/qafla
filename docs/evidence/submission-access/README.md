# Submission access and signed-out Production scan

Checked 22 November 2026. Read-only Chromium, fresh context, no GitHub owner cookies or Qafla session; viewport 390 × 844. [Machine-readable manifest](signed-out-scan.json), [usable sign-in screenshot](production-signed-out.png).

| Requested panel link | Anonymous reviewer result | Owner-only check |
| --- | --- | --- |
| [Production](https://qafla-rjqd.vercel.app) | HTTP 200; usable sign-in rendered | Not needed for sign-in; nine actual account logins were separately verified in the existing panel-access evidence |
| [Park Guide clip](https://github.com/YukonJR12/qafla/raw/12870f381535368cb9b50059b2b835cf3c202277/docs/screenshots/park-3d/park-interaction-390-en.webm) | HTTP 404 | GitHub connector fetched the pinned file using the owner's authorization; blob SHA 00c4b3a88eb58f5bb81463e381ce3de879129e65 |
| [Five-round recording](https://github.com/YukonJR12/qafla/blob/605cee70174878da1705c9931c3076ec0bb0f95d/docs/evidence/submission-race/five-round-race.webm) | HTTP 404 | Owner-authorized connector fetched the pinned file; blob SHA 2a30bbfd57fa3468321872edddf20dc674d3ffd4 |

The repository is private. An owner-authorized fetch is not a reviewer playback check. Panel-authenticated access remains unverified because no panel identity/session was supplied. Invite reviewers and verify their access, or deliver the actual videos/evidence privately. No invitations or messages were sent.

## Partial criterion 6: signed-out scan

Twelve HTML/JavaScript/JSON response bodies loaded by Production sign-in were scanned. Zero matches for OpenRouter key format `sk-or-v1-…`, Supabase `sb_secret_…`, or a JWT with decoded `role=service_role`. The manifest stores URL, HTTP status, content type, byte count, SHA-256 and boolean match results; it contains no response bodies or secret values. The browser version and UTC capture timestamp are in the JSON. No application data was changed.

This refresh retains signed-out Production scanning as partial evidence; no earlier scan file was located in the checkout. It is not exhaustive: it does not inspect signed-in request headers/bodies, authenticated route responses, all lazy chunks, or compare against actual secret values. **Signed-in customer/vendor/manager network inspection remains pending**, including vendor AI traffic; gateway exposure is a separate Premium check. Publishable Supabase keys and user access tokens are not service-role credentials. Key storage locations and exact remaining observations are in [the reconciled inventory](../../../tampering_test.md).

## Supporting isolated database output

[83-check output](isolated-db-results.txt) is the already-completed 22 November isolated PostgreSQL run against shipped migrations at PR #15's merged checkout d4bb42d (app source a1881ec). It is copied here to give each subcase a durable result/data link. It is not an HTTP trace or manual Production capture. No tests were rerun for this documentation-only update.
