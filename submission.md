# Qafla Pickup — submission

**Candidate:** Faisal Alrefae · **Prepared:** 22 November 2026
**Deadline:** Monday, 23 November 2026 at 11:59 PM Kuwait time (UTC+3).

| Open first | Location |
| --- | --- |
| Live app | [Qafla Pickup on Production](https://qafla-rjqd.vercel.app) |
| Repository | [YukonJR12/qafla](https://github.com/YukonJR12/qafla) — private; panel GitHub invitation is still required for full source access |
| Production build | `8ed79b4e7b8d4cbf48bf9b03838d582bd31bda4b`; Vercel READY, Production alias confirmed 22 November |
| Required write-ups | [decisions.md](decisions.md) · [tampering_test.md](tampering_test.md) |
| Login details | The separate **private-demo-logins.md** handoff; passwords are deliberately excluded from this repository |

## Demo accounts and a short panel walkthrough

| Panel identity | Email | Expected landing / assignment |
| --- | --- | --- |
| Customer A | qafla.customer.mwng8ynl@example.com | Explore; customer, no truck assignment |
| Customer B | qafla.ui.mwngu7ha@example.com | Explore; separate customer identity |
| T02 vendor | qafla.vendor.mwng8ynl@example.com | Dune Burgers Kitchen; T02 |
| T06 vendor | qafla.panel.t06.20261122@example.com | Lugaimat & Co Kitchen; T06 |
| Park manager | qafla.manager.mwnh12fm@example.com | Park overview; all six trucks |

1. **Customer A:** Explore → Karak Corner menu → Map. Rotate the park, tap the branded truck and open its information sheet. Open an existing order to inspect its ticket. The Ready → correct truck shortcut is demonstrated in the controlled clip below if no Ready ticket is currently available.
2. **Customer B:** use a separate browser profile/incognito session. Open Explore → Orders → Account to confirm the distinct customer identity. This read-only tour does not substitute for the cross-account direct-request test.
3. **T02 and T06 vendors:** sign into each account separately. Check its own Kitchen and Menu, then the truck assignment on Account. Do not advance orders during the introductory tour.
4. **Manager:** Park overview → Rush Forecast → Replay the evening. Select Taco Saha's 8:00 PM slot, inspect the booking pace, advance from 7:00 PM to 7:46 PM, compare the earlier forecast with the final simulated count, then rewind. The replay uses the latest completed evening, so its service date can move after midnight.

All five panel logins and assignments have a [current Production access record](docs/evidence/submission-final-access/README.md). No account is missing. Customer, vendor and manager polish from PRs #19–21 is merged; this submission freezes feature development.

## Shipped stretch features

**3D Park Guide — recognize the pickup counter before walking over.** [Play the 14.6-second mobile clip](docs/screenshots/park-3d/park-interaction-390-en.webm). It shows Map → rotate → branded Karak Corner → information sheet, then a Ready Dune Burgers ticket opening T02 even when paused for new orders. This reused local production-build **controlled fixture** uses `FIXTURE-READY-T02`; it is not a real Production order. Its starting navigation is Account → Map; Explore → Map is separately verified. [Setup and limits](docs/screenshots/park-3d/README.md).

**Rush Forecast — which kitchen should Dana check next?** [Play the mobile replay](docs/evidence/easyui-forecast/mobile-replay.webm) · [deployed prediction beside outcome](docs/evidence/preview-approval-19-21/21-390-en-comparison.png). The numerical model uses booking timestamps and comparable earlier evenings; the AI explains selected aggregates, with a deterministic fallback. “Demo forecast · simulated history” and the replay clock stay visible. The shared database contains explicitly marked generated demo history, not genuine demand.

Latest retained **simulated** validation: **0.8923 orders/slot** mean absolute error versus **2.0552** for no-more-bookings, over **5,906** predictions on **14** held-out evenings (43 training evenings). [Exact results](docs/evidence/easyui-forecast/validation.json). This establishes simulated behavior, not real-world forecast accuracy. The reused local replay clip and [deployed observations](docs/evidence/preview-approval-19-21/README.md) have separate provenance; OpenRouter was not called in that deployed UI check.

**Phone checks are Chrome emulation**, English/Arabic at 320/390 px with desktop checks. Physical-device pinch smoothness remains unverified. The recorded 1.62-second Map opening is a local desktop result, not a mobile-network benchmark.

## Levels and evidence status

Levels count in order; Core plus the live Tampering Test is the assessment pass bar. Representative screenshots demonstrate the stated capabilities; they do not certify a whole level when live observations remain pending.

- [ ] **Core + Tampering Test:** app features shipped; live direct-request criteria 1–5 and signed-in key inspection remain pending as individually enumerated in tampering_test.md. The 1a screenshot proves a 3.200 KWD baseline/cancelled attempt; isolated PostgreSQL proves repricing. Neither is the missing Production price-tampering observation.
- [ ] **Level 2 · Premium:** historical MyFatoorah sandbox payment, fake-success rejection and refund-due evidence exists. Current live fake-success observation and signed-in gateway-key inspection remain pending. No real-money payment is part of this submission.
- [ ] **Level 3 · Elite:** five-round isolated race, real-model injection result and Preview forced-error screenshot/log are packaged. The stated live-link race requirement is not yet evidenced unless CODED accepts the isolated setup; an independent new-TA clean setup rehearsal is also unverified.
- [x] **Stretch implementation:** 3D Park Guide, bilingual experience and Rush Forecast are shipped. Numerical forecast validation is simulated. This does not bypass the earlier level gates.

## Five-round last-slot recording

[Open the 20.8-second side-by-side recording](docs/evidence/submission-race/five-round-race.webm) · [setup, original recordings and screenshots](docs/evidence/submission-race/README.md) · [resulting data](docs/evidence/submission-race/results.json).

**Environment: isolated local production build, real PostgreSQL 17, test auth/clock and HTTP adapter. Not Production or hosted Supabase.** Refreshed on 22 November against application `a1881ec` in PR15 checkout `d4bb42d`; it has not been relabelled as an 8ed79b4 run. Five slots each began at 5/6. Two independent browser sessions submitted together; every round produced one confirmed ticket, one `slot_full` recovery with preserved cart, and exactly one extra order (6/6, never 7/6). Outcomes come from real PostgreSQL locking, not fabricated successful/refused responses. The 5 fps composition preserves elapsed speed; originals are retained. Runner exit 0, no interrupt.

## Attachment package

The three root Markdown files are supplied directly. **qafla-evidence.zip** contains the same files and all of their local evidence/source references with relative paths preserved, so the private GitHub links are not the only way to inspect the evidence. Unzip before following local links. The private login handoff is separate and excluded from this evidence archive.

| Representative attachment | What it substantiates / environment |
| --- | --- |
| `level-1-core-menu.png` | Current Production 8ed79b4 customer menu with seeded branding, menu prices and Add controls; 390 px Chrome emulation |
| `level-2-premium-payment.jpg` | Historical MyFatoorah sandbox Preview payment confirmation; not a new Production payment |
| `level-3-elite-forced-error.jpg` | Historical Preview missing-key failure with preserved edit and matching log reference; not an invalid-key rejection |
| `stretch-park-guide.png` | Current Production 3D Park Guide at 390 px Chrome emulation |

Elite extras are also supplied directly: `five-round-race.webm`, `injection-card-result.md`, `injection-card-result.jpg`, and `forced-error-log.txt`. The forced-error representative screenshot above doubles as the required error screenshot. The archive preserves the 1a baseline, original race videos, per-round before/after screenshots and counts, the Park Guide/replay clips, sandbox and injection write-ups, and source rules linked by the Markdown files. [Packaging and access record](docs/evidence/submission-final-access/README.md).

## Reviewer access and scope

Fresh browser sessions with no owner GitHub cookies can reach Production and sign into the five panel accounts. The repository and pinned recording links return **404 without repository access**. Their presence is confirmed from the owner checkout; that does not establish authenticated panel GitHub access. Local copies in the evidence archive remove that barrier for the attachments. Faisal must still invite the GitHub identity supplied by Ahmad for full repository review. No sharing settings were changed and no email was sent.

Existing checks are reused with their original build/environment labels: the customer suite reports 118 unit, 57 browser and 86 isolated database checks; vendor 117/55/86; forecast final code passed 34 combined focused journeys after its earlier 43-test browser run. Database processes exited 0 normally. This documentation reconciliation changes no shipped application code, dependencies or migrations. It preserves the race test and evidence from PR15. No new Production orders, payments, closures or menu edits were made.

## Before sending

The single remaining-manual-observation checklist is in [tampering_test.md](tampering_test.md#manual-observations-still-owed-by-faisal). Complete the chosen live attempts, insert sanitized responses and data-after evidence, and update level claims before declaring the pass bar complete. If sending before completion, keep those limitations explicit.

Faisal must review/approve PR #15 and these write-ups in his own voice, arrange panel GitHub access, approve private demo-login delivery, and confirm onboarding/presentation availability personally. Keep the app live through the panel session. The local reply to Ahmad is a draft only; sending and availability confirmation remain Faisal's actions.
