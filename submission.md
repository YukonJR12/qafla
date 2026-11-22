# Qafla Pickup — submission preparation

Candidate: **Faisal Alrefae**. Prepared: 22 November 2026.
Deadline: **Monday, 23 November 2026, 11:59 PM Kuwait time (UTC+3)**.
Status: vendor account setup and the five-round isolated recording are complete and reverified. Submission still requires the assessment-specific live observations and owner actions marked below. Refreshed against Production a1881ec (PR #16), 22 November 2026.

## Mobile demo — shipped 3D Park Guide

[Play the 14.6-second mobile clip](docs/screenshots/park-3d/park-interaction-390-en.webm) · [Download from GitHub](https://github.com/YukonJR12/qafla/raw/12870f381535368cb9b50059b2b835cf3c202277/docs/screenshots/park-3d/park-interaction-390-en.webm)

<video controls width="390" src="docs/screenshots/park-3d/park-interaction-390-en.webm" poster="docs/screenshots/park-3d/karak-sheet-390-en.png"></video>

Open Map → rotate the park → select branded Karak Corner → see its information sheet → open a Ready Dune Burgers ticket → Find my truck selects T02, even while it is paused for new orders. The recording starts from Account's shared Map navigation, not Explore. Explore → Map is also a verified Production journey.

This is reused controlled-fixture evidence from commit 3ca0776: local production build, Chromium 159, 390 × 844 touch emulation, fake customer and Ready ticket FIXTURE-READY-T02. It is not footage of a real Production order. The feature shipped in PR #13; current Production includes PR #14 and PR #16 (a1881ec). [Evidence and limits](docs/screenshots/park-3d/README.md).

**Phone checks are Chrome emulation:** 320/390 px, English/Arabic. Physical-device pinch smoothness remains unverified. The recorded 1.62-second Map load is a local desktop measurement, not mobile-network performance.

## Panel starting path — five accounts

Open [Production](https://qafla-rjqd.vercel.app). Use the matching credentials from the **private panel handoff**; no passwords are in these files. Keep Customer A and B in separate browser profiles/incognito sessions. This starting path is read-only: no order placement, payment, status changes or truck closures.

1. **Customer A:** sign in → Explore → a branded truck menu → Map → rotate/select a truck and view its sheet. Open Orders to inspect an existing ticket; use Find my truck only if a Ready ticket exists. The Park Guide clip supplies the controlled Ready → T02 demonstration if none exists live.
2. **Customer B:** in the second session, sign in → Explore → Orders → Account. Confirm a distinct customer identity and its own order list. This UI check is not a substitute for the cross-account direct-request evidence in tampering_test.md.
3. **T02 vendor:** sign in → Dune Burgers Kitchen → inspect existing tickets and Account's truck assignment. Do not advance orders during this read-only tour.
4. **T06 vendor:** sign in → Lugaimat & Co Kitchen → inspect its own board and Account assignment. An empty board is valid; do not create an order to fill it.
5. **Manager:** sign in → Tonight across the park → inspect all six trucks/slot usage → Account confirms Park manager. Finish with the five-round recording and its per-round counts; it is isolated evidence, not a Production race.

The account emails and verified landing screens are listed below. Account provisioning is complete; private credential delivery and reviewer repository access are still owner actions.

## Latest shipped customer verification

PR #16 is merged and deployed. Fresh launch, actual customer sign-in, returning-session launch, truck menu opening and first Add passed on Production in **English/Arabic at 320 and 390 px**. No orders or payments were created. [Production assertions and screenshots](docs/evidence/production-pr16/README.md) · [Commit-pinned evidence](https://github.com/YukonJR12/qafla/blob/605cee70174878da1705c9931c3076ec0bb0f95d/docs/evidence/production-pr16/README.md).

[Updated 13.9-second customer-flow clip](docs/evidence/mobile-performance/final-interaction/390-en-motion.webm) shows the same shipped application changes in a **local production build**, not Production footage. [Timing methodology and remaining warm-launch tradeoff](docs/evidence/mobile-performance/README.md).

## Five-round last-slot recording

[Watch the two-session race](docs/evidence/submission-race/five-round-race.webm) · [Commit-pinned GitHub copy](https://github.com/YukonJR12/qafla/blob/605cee70174878da1705c9931c3076ec0bb0f95d/docs/evidence/submission-race/five-round-race.webm) · [Setup and per-round data](docs/evidence/submission-race/README.md)

**Refreshed on the latest shipped code: 20.8 seconds**, A on the left and B on the right. Five rounds: one confirmed ticket, one slot-full recovery, and exactly one extra order per slot (5→6). **Isolated local production build, real PostgreSQL 17, test auth/HTTP adapter. Not the live deployment.** The assessment's live-link observation remains pending unless this environment is accepted. The rerun passed in 41.6 seconds including build and exited 0 without an interrupt. Original A/B videos, before/after screenshots and per-round JSON are retained. No Production orders or payments were created.

## Links the panel can open

| Material | Link | Access / status |
| --- | --- | --- |
| Live app | https://qafla-rjqd.vercel.app | Public sign-in page; all nine demo logins reverified on Production a1881ec, 22 Nov |
| Repository | https://github.com/YukonJR12/qafla | **Private. Anonymous access returns 404. Panel invitation or attached evidence required.** |
| Schema and reasoning | [decisions.md](decisions.md) | Prepared from code and existing evidence; candidate review needed |
| Tampering evidence inventory | [tampering_test.md](tampering_test.md) | Incomplete live report; gaps explicitly marked |
| Setup / handover | [README](README.md), [.env.example](.env.example), [migrations](supabase/migrations), [seed builder](scripts/build-seed.mjs) | Files present; fresh-machine handover not independently rerun |
| Core screenshot | [Collected ticket and rating](docs/screenshots/pickup-ticket/collected-rating-en-320.jpg) | Existing screenshot; capture provenance not established by this audit |
| Premium screenshot | [Payment confirmed](docs/evidence/payments/preview-04-payment-confirmed.jpg) | Historical sandbox Preview evidence |
| Elite race | [Two-session recording](docs/evidence/submission-race/five-round-race.webm), [results and setup](docs/evidence/submission-race/README.md) | Five rounds passed on isolated PostgreSQL; not the submitted live deployment |
| Elite supporting screenshot | [Forced AI error](docs/evidence/ai-menu/forced-error-preview.jpg) | Historical Preview evidence |
| AI injection result | [Write-up](docs/evidence/ai-menu/injection-card-local.md) | Real OpenRouter, local production build, 20 Nov |
| Forced AI failure | [Screenshot](docs/evidence/ai-menu/forced-error-preview.jpg), [matching log](docs/evidence/ai-menu/forced-error-preview-log.txt) | Missing-key failure; not an invalid-key rejection |
| Payment evidence | [Preview sandbox run](docs/evidence/payments/preview-sandbox-run.md) | Paid/unpaid, fake success, failure and refund-due evidence; documented limits retained |

**Reviewer-access check, 22 November:** fresh signed-out Chromium with no owner GitHub cookies reached Production (HTTP 200) and displayed usable sign-in. The exact pinned Park Guide download and five-round recording links both returned **404**. Both files were retrievable through the **owner-authorized GitHub connector only**; that confirms the files exist, not that a panel member can open them. No panel GitHub identity/invitation was available to verify authenticated reviewer access. [Statuses, URLs and screenshot](docs/evidence/submission-access/README.md).

Before delivery, invite the panel's GitHub accounts and have one confirm both clips open, or privately attach the clips and referenced evidence directories alongside the Markdown files. Do not rely on private GitHub URLs alone. No sharing settings were changed and no attachments were sent.

## Five demo accounts — release gate

Do not publish passwords in Git. Supply disposable panel credentials privately in the assessment email or its private attachment. The blank starter template is not a usable credential handover.

| Panel identity | Required database role | Required assignment | Current verification | Faisal action |
| --- | --- | --- | --- | --- |
| Customer A | customer | none | qafla.customer.mwng8ynl@example.com: fresh sign-in → Explore; Account says Customer | Pass verified credentials privately to panel |
| Customer B | customer | none, distinct account | qafla.ui.mwngu7ha@example.com: fresh sign-in → Explore; Account says Customer | Pass verified credentials privately to panel |
| Dune vendor | vendor | T02 Dune Burgers | qafla.vendor.mwng8ynl@example.com: fresh sign-in → Dune Burgers kitchen; Account says Truck vendor · Dune Burgers | Pass verified credentials privately to panel |
| Lugaimat vendor | vendor | T06 Lugaimat & Co | qafla.panel.t06.20261122@example.com: fresh sign-in → Lugaimat & Co kitchen; Account confirms vendor and truck | New credentials are in the private handoff |
| Park manager | manager | none | qafla.manager.mwnh12fm@example.com: fresh sign-in → Tonight across the park; Account says Park manager | Pass verified credentials privately to panel |

**No account or assignment is missing.** All five required panel identities and all six vendor logins were reverified on Production a1881ec. At Faisal's subsequent request, separate vendor accounts were also created and assigned to previously unassigned T01, T03, T04 and T05. Each signed into its matching kitchen and showed the correct vendor/truck in Account. T02 and all existing passwords were preserved. No duplicate accounts, password changes or reassignments were needed in this refresh. See the [complete nine-account inventory](docs/evidence/panel-access/README.md) and [current verified roles/assignments](https://github.com/YukonJR12/qafla/blob/605cee70174878da1705c9931c3076ec0bb0f95d/docs/evidence/panel-access/current/results.json). Passwords live only in the Git-ignored private handoff.

## Assessment audit and levels

Checked against the supplied assessment PDF (pages 2–6), owner brief and starter templates. Levels count in order, with Core plus live Tampering Test the pass bar.

| Requirement | Actual submission evidence | Remaining gap |
| --- | --- | --- |
| Core app and six direct-request attacks | Shipped app, migrations, 108 unit tests and 83 isolated database checks; live report now has an inventory | Criteria 1–5 need the enumerated manual Production responses and data-after captures; criterion 6 has signed-out Production evidence, but signed-in network/bundle inspection remains pending |
| Premium | MyFatoorah sandbox Preview evidence and fake-return results | Repository access for panel; signed-in gateway-key network/bundle inspection remains pending |
| Elite race | Two independent customer browser contexts; five recorded rounds, one saved ticket and one slot_full each; database count 5→6 each round | Isolated local production build, real PostgreSQL with auth/HTTP adapter; the assessment asks for the live link, so live-deployment observation remains pending |
| Elite injection | Local real-model result and screenshot exist | Clearly label local provenance; do not present as Production execution |
| Elite forced error | Preview missing-key screenshot/log share reference 238caf74 | Keep precise description of missing-key failure |
| Elite handover | README, env names, ordered migrations and generated seed present | Independent clean setup rehearsal still unverified |
| Stretch | 3D Park Guide shipped; bilingual customer UI | Physical phone pinch smoothness unverified |
| Required write-ups | Root submission.md, decisions.md, tampering_test.md prepared; name, deadline and demo logins confirmed | Live tampering details, personal failure stories and level claims need sign-off |
| Presentation | Assessment requests 7-minute demo, 8-minute walkthrough, 5-minute teach-back, 5-minute Q&A | Deadline above confirmed; presentation slot and rehearsal still needed; no deck required by the PDF |

**Do not mark Core/Premium/Elite fully evidenced yet.** The shipped features and their local/Preview checks are distinct from the assessment's complete live evidence package.

Validation after bringing PR #15 up to current main: lint, typecheck, production build, 108/108 unit tests, the refreshed five-round browser race, and 83/83 database checks passed. Both race and database processes exited 0 without interruption. All new relative evidence links were checked locally. Nine fresh Production logins and all six vendor assignments were reverified against the shipped PR #16 build. Tracked evidence contains no passwords; credentials must be delivered separately. This is not a claim that an attachment has been sent.

## Inputs needed before sending

1. Confirm the presentation slot and keep the app live through the session. Candidate name and submission deadline are set above.
2. Deliver the private credential handoff (two customers, all six vendors and manager). No account or assignment still needs setup. Invite the panel's GitHub accounts or attach the evidence package. No password is in this repository.
3. Finish the missing live observations in tampering_test.md. The authorized race now has isolated evidence; obtain CODED's agreement to that environment or arrange a dedicated deployed test database for a live rerun. Preview shares Production's database; no Production orders or payments were created here.
4. Review decisions.md in your own voice, especially the two failure stories. Review the final level claims and send the package in the original assessment email thread. Nothing has been emailed.
