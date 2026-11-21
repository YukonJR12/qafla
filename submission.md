# Qafla Pickup — submission preparation

Candidate: **Faisal Alrefae**. Prepared: 22 November 2026.
Deadline: **Monday, 23 November 2026, 11:59 PM Kuwait time (UTC+3)**.
Status: shipped app; submission evidence package still needs the items marked pending below.

## Mobile demo — shipped 3D Park Guide

[Play the 14.6-second mobile clip](docs/screenshots/park-3d/park-interaction-390-en.webm) · [Download from GitHub](https://github.com/YukonJR12/qafla/raw/12870f381535368cb9b50059b2b835cf3c202277/docs/screenshots/park-3d/park-interaction-390-en.webm)

<video controls width="390" src="docs/screenshots/park-3d/park-interaction-390-en.webm" poster="docs/screenshots/park-3d/karak-sheet-390-en.png"></video>

Open Map → rotate the park → select branded Karak Corner → see its information sheet → open a Ready Dune Burgers ticket → Find my truck selects T02, even while it is paused for new orders. The recording starts from Account's shared Map navigation, not Explore. Explore → Map is also a verified Production journey.

This is reused controlled-fixture evidence from commit 3ca0776: local production build, Chromium 159, 390 × 844 touch emulation, fake customer and Ready ticket FIXTURE-READY-T02. It is not footage of a real Production order. The feature shipped in PR #13; current Production also includes PR #14. [Evidence and limits](docs/screenshots/park-3d/README.md).

**Phone checks are Chrome emulation:** 320/390 px, English/Arabic. Physical-device pinch smoothness remains unverified. The recorded 1.62-second Map load is a local desktop measurement, not mobile-network performance.

## Five-round last-slot recording

[Watch the two-session race](docs/evidence/submission-race/five-round-race.webm) · [Commit-pinned GitHub copy](https://github.com/YukonJR12/qafla/blob/28f5d748f3e5492d9037051857f7bde83e2eeab2/docs/evidence/submission-race/five-round-race.webm) · [Setup and per-round data](docs/evidence/submission-race/README.md)

22.2 seconds, A on the left and B on the right. Five rounds: one confirmed ticket, one slot-full recovery, and exactly one extra order per slot (5→6). **Isolated local production build, real PostgreSQL 17, test auth/HTTP adapter. Not the live deployment.** The assessment's live-link observation remains pending unless this environment is accepted. No Production orders or payments were created.

## Links the panel can open

| Material | Link | Access / status |
| --- | --- | --- |
| Live app | https://qafla-rjqd.vercel.app | Public sign-in page; all nine demo logins verified on Production, 22 Nov |
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

When emailing standalone Markdown files, also attach the referenced evidence folder or grant the panel repository access. Relative paths alone do not carry files with an email. Pinned links are stable, but still require access to this private repository. Anonymous GET checks returned 200 for app sign-in and 404 for the repository and pinned park video. The owner's signed-in GitHub view shows the repository as Private; it is not proof of panel access. See [access evidence](docs/evidence/panel-access/README.md).

## Five demo accounts — release gate

Do not publish passwords in Git. Supply disposable panel credentials privately in the assessment email or its private attachment. The blank starter template is not a usable credential handover.

| Panel identity | Required database role | Required assignment | Current verification | Faisal action |
| --- | --- | --- | --- | --- |
| Customer A | customer | none | qafla.customer.mwng8ynl@example.com: fresh sign-in → Explore; Account says Customer | Pass verified credentials privately to panel |
| Customer B | customer | none, distinct account | qafla.ui.mwngu7ha@example.com: fresh sign-in → Explore; Account says Customer | Pass verified credentials privately to panel |
| Dune vendor | vendor | T02 Dune Burgers | qafla.vendor.mwng8ynl@example.com: fresh sign-in → Dune Burgers kitchen; Account says Truck vendor · Dune Burgers | Pass verified credentials privately to panel |
| Lugaimat vendor | vendor | T06 Lugaimat & Co | qafla.panel.t06.20261122@example.com: fresh sign-in → Lugaimat & Co kitchen; Account confirms vendor and truck | New credentials are in the private handoff |
| Park manager | manager | none | qafla.manager.mwnh12fm@example.com: fresh sign-in → Tonight across the park; Account says Park manager | Pass verified credentials privately to panel |

All five required panel identities are verified. At Faisal's subsequent request, separate vendor accounts were also created and assigned to previously unassigned T01, T03, T04 and T05. Each signed into its matching kitchen and showed the correct vendor/truck in Account. T02 and all existing passwords were preserved. See the [complete nine-account inventory](docs/evidence/panel-access/README.md). Passwords live only in the Git-ignored private handoff.

## Assessment audit and levels

Checked against the supplied assessment PDF (pages 2–6), owner brief and starter templates. Levels count in order, with Core plus live Tampering Test the pass bar.

| Requirement | Actual submission evidence | Remaining gap |
| --- | --- | --- |
| Core app and six direct-request attacks | Shipped app, migrations, 108 unit tests and 83 isolated database checks; live report now has an inventory | Live attempts 1–6 need request/response, data-after proof, rule and screenshot per attempt |
| Premium | MyFatoorah sandbox Preview evidence and fake-return results | Repository access for panel; live client-bundle/network gateway-key scan not packaged |
| Elite race | Two independent customer browser contexts; five recorded rounds, one saved ticket and one slot_full each; database count 5→6 each round | Isolated local production build, real PostgreSQL with auth/HTTP adapter; the assessment asks for the live link, so live-deployment observation remains pending |
| Elite injection | Local real-model result and screenshot exist | Clearly label local provenance; do not present as Production execution |
| Elite forced error | Preview missing-key screenshot/log share reference 238caf74 | Keep precise description of missing-key failure |
| Elite handover | README, env names, ordered migrations and generated seed present | Independent clean setup rehearsal still unverified |
| Stretch | 3D Park Guide shipped; bilingual customer UI | Physical phone pinch smoothness unverified |
| Required write-ups | Root submission.md, decisions.md, tampering_test.md prepared; name, deadline and demo logins confirmed | Live tampering details, personal failure stories and level claims need sign-off |
| Presentation | Assessment requests 7-minute demo, 8-minute walkthrough, 5-minute teach-back, 5-minute Q&A | Deadline above confirmed; presentation slot and rehearsal still needed; no deck required by the PDF |

**Do not mark Core/Premium/Elite fully evidenced yet.** The shipped features and their local/Preview checks are distinct from the assessment's complete live evidence package.

Validation on this PR: lint, typecheck, production build, 108/108 unit tests, the five-round browser race, and 83/83 database checks passed. Both race and database processes exited 0 without interruption. All new relative evidence links were checked locally. Nine fresh Production logins and all six vendor assignments were verified. The evidence attachment contains no passwords; credentials must be delivered separately.

## Inputs needed before sending

1. Confirm the presentation slot and keep the app live through the session. Candidate name and submission deadline are set above.
2. Deliver the private credential handoff (two customers, all six vendors and manager). No account or assignment still needs setup. Invite the panel's GitHub accounts or attach the evidence package. No password is in this repository.
3. Finish the missing live observations in tampering_test.md. The authorized race now has isolated evidence; obtain CODED's agreement to that environment or arrange a dedicated deployed test database for a live rerun. Preview shares Production's database; no Production orders or payments were created here.
4. Review decisions.md in your own voice, especially the two failure stories. Review the final level claims and send the package in the original assessment email thread. Nothing has been emailed.
