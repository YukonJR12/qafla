# Submission freeze and panel access — 22 November 2026

Production: [Qafla Pickup](https://qafla-rjqd.vercel.app), commit **8ed79b4e7b8d4cbf48bf9b03838d582bd31bda4b**, Vercel **dpl_obqrnLotJVQeMx31iyMtMsnJMWzR**, READY with the Production alias assigned. Current origin/main matches. PRs 19, 20 and 21 are merged.

Fresh Chromium **159.0.8154.6** sessions on Windows, **390×844 touch emulation, DPR 1**, signed into each of the five panel identities through the actual UI. Customer A/B landed on Explore, T02/T06 vendors on their respective kitchens, and the manager on Park overview. Account role and truck text matched in each case. No account or assignment is missing. [Recorded results](results.json).

All REST mutations except the read-only slot_usage/forecast_history RPCs were blocked by the verification harness; no such attempted mutations occurred. Payments were blocked. No orders, prices, capacities, statuses or closures changed. Authentication requests and existing-data reads were real. This was access verification, not a direct-request Tampering Test or a new signed-in key scan.

## What an unauthenticated reviewer can open

| Target | Fresh-session result |
| --- | --- |
| Production | HTTP 200, usable sign-in; [capture](signed-out-production.png) |
| Repository | HTTP 404; private |
| Exact pinned Park Guide clip | HTTP 404 without GitHub access |
| Exact pinned five-round recording | HTTP 404 without GitHub access |

The evidence exists in the owner-authorized checkout. Owner access is not proof of panel access. The handoff therefore supplies local copies, preserving relative paths, in **qafla-evidence.zip**. The panel still needs its GitHub invitation for the complete repository; no sharing permissions were changed. Passwords are in a separate private handoff, not Git or the evidence archive.

Historical Vercel Preview URLs in inherited write-ups are protected and are not panel entry points. Use Production for the live app and the included local screenshots, recordings and logs for those historical observations. Private repository/PR pages still require an invitation; no evidence attachment relies solely on them.

## Representative screenshots

- Core capability: [current Production menu](level-1-core-menu.png).
- Premium capability: [historical sandbox confirmation](../payments/preview-04-payment-confirmed.jpg), with [response/data provenance](../payments/preview-sandbox-run.md).
- Elite supporting evidence: [historical forced-error screen](../ai-menu/forced-error-preview.jpg) and [matching log](../ai-menu/forced-error-preview-log.txt).
- Stretch: [current Production Park Guide](stretch-park-guide.png).

These do not mark a level passed while its mandatory live observations remain pending. The payment and AI screenshots predate the latest UI polish and are retained to substantiate actual provider observations rather than a fabricated current run.

## Reconciliation and packaging

PR15 was reconciled in a separate worktree with current main. The sole conflict was the add/add in decisions.md; both the original schema/security write-up and the shipped Rush Forecast record are retained, with the latter's outdated badge wording and benchmark provenance corrected. The app, dependencies and migrations are byte-identical to main. The existing isolated race test remains in PR15. The baseline capture is unchanged: Git blob **33c02d53112015f4e0dd10faf3ac51387534673b**; SHA-256 **6f301d71b2feb69b6b0ef330ecff61735672ecadf6d185134a1d9aa4e2282633**.

The local package includes the three required Markdown files, one representative screenshot for each evidenced capability, the required Elite extras, the original recordings/data and locally resolvable evidence/source references. Private GitHub file links are rewritten to corresponding local snapshots in the offline copy where necessary; the repository versions retain their original provenance links. The manifest records file hashes. Private credentials are excluded from the archive and scans check the package against the known demo passwords.

[Media-open results](package-media-check.json): all **65** included images/videos decoded; all **7** videos played, including the 20.8-second race, 14.6-second Park Guide and 22.04-second forecast replay. Samples across the recordings show the expected outcomes, not credentials. The private account-screen proofs are excluded from the handoff. [Link and attachment checks](package-link-check.json) record **119 offline files**, **159 resolved local links**, zero missing files and zero unresolved Markdown anchors. Production and the 15 public source-attribution links returned 200; the three historical Preview links redirected to Vercel sign-in. Original media is unchanged.

The email is a **local unsent draft only**, following Faisal's choice after Gmail requested reauthentication. Its original subject and recipient must be retained when Faisal pastes it into Ahmad's existing thread. Onboarding/presentation availability is deliberately left for Faisal.
