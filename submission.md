# Qafla Pickup — submission preparation

Candidate: Faisal (confirm submission name). Prepared: 22 November 2026, Riyadh time.
Status: shipped app; submission evidence package still needs the items marked pending below.

## Mobile demo — shipped 3D Park Guide

[Play the 14.6-second mobile clip](docs/screenshots/park-3d/park-interaction-390-en.webm) · [Download from GitHub](https://github.com/YukonJR12/qafla/raw/12870f381535368cb9b50059b2b835cf3c202277/docs/screenshots/park-3d/park-interaction-390-en.webm)

<video controls width="390" src="docs/screenshots/park-3d/park-interaction-390-en.webm" poster="docs/screenshots/park-3d/karak-sheet-390-en.png"></video>

Open Map → rotate the park → select branded Karak Corner → see its information sheet → open a Ready Dune Burgers ticket → Find my truck selects T02, even while it is paused for new orders. The recording starts from Account's shared Map navigation, not Explore. Explore → Map is also a verified Production journey.

This is reused controlled-fixture evidence from commit 3ca0776: local production build, Chromium 159, 390 × 844 touch emulation, fake customer and Ready ticket FIXTURE-READY-T02. It is not footage of a real Production order. The feature shipped in PR #13; current Production also includes PR #14. [Evidence and limits](docs/screenshots/park-3d/README.md).

**Phone checks are Chrome emulation:** 320/390 px, English/Arabic. Physical-device pinch smoothness remains unverified. The recorded 1.62-second Map load is a local desktop measurement, not mobile-network performance.

## Links the panel can open

| Material | Link | Access / status |
| --- | --- | --- |
| Live app | https://qafla-rjqd.vercel.app | Login required; panel credentials pending |
| Repository | https://github.com/YukonJR12/qafla | Faisal must confirm panel access; authenticated agent access is not proof of public access |
| Schema and reasoning | [decisions.md](decisions.md) | Prepared from code and existing evidence; candidate review needed |
| Tampering evidence inventory | [tampering_test.md](tampering_test.md) | Incomplete live report; gaps explicitly marked |
| Setup / handover | [README](README.md), [.env.example](.env.example), [migrations](supabase/migrations), [seed builder](scripts/build-seed.mjs) | Files present; fresh-machine handover not independently rerun |
| Core screenshot | [Collected ticket and rating](docs/screenshots/pickup-ticket/collected-rating-en-320.jpg) | Existing screenshot; capture provenance not established by this audit |
| Premium screenshot | [Payment confirmed](docs/evidence/payments/preview-04-payment-confirmed.jpg) | Historical sandbox Preview evidence |
| Elite supporting screenshot | [Forced AI error](docs/evidence/ai-menu/forced-error-preview.jpg) | Historical Preview evidence; Elite completion still pending race |
| AI injection result | [Write-up](docs/evidence/ai-menu/injection-card-local.md) | Real OpenRouter, local production build, 20 Nov |
| Forced AI failure | [Screenshot](docs/evidence/ai-menu/forced-error-preview.jpg), [matching log](docs/evidence/ai-menu/forced-error-preview-log.txt) | Missing-key failure; not an invalid-key rejection |
| Payment evidence | [Preview sandbox run](docs/evidence/payments/preview-sandbox-run.md) | Paid/unpaid, fake success, failure and refund-due evidence; documented limits retained |

When emailing standalone Markdown files, also attach the referenced evidence folder or provide working repository links. Relative paths alone do not carry the files with an email. The video download link above is pinned to shipped source.

## Five demo accounts — release gate

Do not publish passwords in Git. Supply disposable panel credentials privately in the assessment email or its private attachment. The blank starter template is not a usable credential handover.

| Panel identity | Required database role | Required assignment | Current verification | Faisal action |
| --- | --- | --- | --- | --- |
| Customer A | customer | none | Existing customer session exercised Production; not designated as panel A | Confirm email, login and private password handoff |
| Customer B | customer | none, distinct account | No panel account identified in submission files | Confirm/create and test login |
| Dune vendor | vendor | T02 Dune Burgers | Historical T02 vendor evidence exists; current panel login not confirmed | Confirm profile role and trucks.vendor_id mapping |
| Lugaimat vendor | vendor | T06 Lugaimat & Co | No current panel assignment evidence found | Confirm/create vendor, assign T06, test login |
| Park manager | manager | none | Manager session previously observed; panel credentials unconfirmed | Confirm database-set manager role and private login handoff |

Do not infer live accounts from tests/db fixtures. No accounts, passwords, roles or assignments were changed during submission preparation.

## Assessment audit and levels

Checked against the supplied assessment PDF (pages 2–6), owner brief and starter templates. Levels count in order, with Core plus live Tampering Test the pass bar.

| Requirement | Actual submission evidence | Remaining gap |
| --- | --- | --- |
| Core app and six direct-request attacks | Shipped app, migrations, 108 unit tests and 83 isolated database checks; live report now has an inventory | Live attempts 1–6 need request/response, data-after proof, rule and screenshot per attempt |
| Premium | MyFatoorah sandbox Preview evidence and fake-return results | Current panel access; live client-bundle/network gateway-key scan not packaged |
| Elite race | Five-round two-connection SQL tests exist | **No two-browser five-round last-slot recording found**; SQL tests are not the requested screen recording |
| Elite injection | Local real-model result and screenshot exist | Clearly label local provenance; do not present as Production execution |
| Elite forced error | Preview missing-key screenshot/log share reference 238caf74 | Keep precise description of missing-key failure |
| Elite handover | README, env names, ordered migrations and generated seed present | Independent clean setup rehearsal still unverified |
| Stretch | 3D Park Guide shipped; bilingual customer UI | Physical phone pinch smoothness unverified |
| Required write-ups | Root submission.md, decisions.md, tampering_test.md now prepared | Candidate name, accounts, live tampering details, personal failure stories and level claims need sign-off |
| Presentation | Assessment requests 7-minute demo, 8-minute walkthrough, 5-minute teach-back, 5-minute Q&A | Confirm deadline/slot and rehearse; no deck required by the PDF |

**Do not mark Core/Premium/Elite fully evidenced yet.** The shipped features and their local/Preview checks are distinct from the assessment's complete live evidence package.

## Inputs needed before sending

1. Confirm candidate name, submission deadline and presentation slot with the CODED contact; keep the app live through the session.
2. Confirm all five account logins and T02/T06 assignments; privately hand over disposable passwords and grant repository access if needed.
3. Approve a dedicated disposable test environment/account plan for the missing live attacks and five-round race, or obtain agreement that an isolated deployment is acceptable. Preview shares Production's database; a race creates orders, so it was not run under the no-order constraint.
4. Review decisions.md in your own voice, especially the two failure stories. Review the final level claims and send the package in the original assessment email thread. Nothing has been emailed.
