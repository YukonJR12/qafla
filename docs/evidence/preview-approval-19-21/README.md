# Preview approval checks — PRs 19, 20 and 21

Verified 22 November 2026. All three PRs remain open for Faisal's visual approval. No orders, payments, menu changes or other shared database writes were made.

## Open the tested builds

These are regular protected Vercel URLs. Sign into Vercel if prompted, then use the indicated Qafla account from the private panel handoff. Passwords and temporary Vercel access links are not included here.

| PR | Tested commit | Preview | Qafla role / starting path |
| --- | --- | --- | --- |
| [19 · Customer](https://github.com/YukonJR12/qafla/pull/19) | `7e351205f19109bea3cc0007ac400b22db73ebf5` | [Customer Preview](https://qafla-rjqd-qgkjh4c56-ffalrefae-6713s-projects.vercel.app) | Customer A → Karak Corner menu; Map; an existing ticket |
| [20 · Vendor](https://github.com/YukonJR12/qafla/pull/20) | `0640cd04b9527ace85e7041f92fcdd01e71e2df5` | [Vendor Preview](https://qafla-rjqd-hlyviohew-ffalrefae-6713s-projects.vercel.app) | T02 Dune Burgers vendor → Menu → Classic smash |
| [21 · Manager](https://github.com/YukonJR12/qafla/pull/21) | `c304fbde6d8f020e65ee5241db476b3f4b2db9e2` | [Manager Preview](https://qafla-rjqd-rh2dkurub-ffalrefae-6713s-projects.vercel.app) | Manager → Park overview → Rush Forecast → Replay the evening |

The commit adding this directory to PR21 changes evidence only. The Preview links above identify the exact builds exercised, rather than moving branch aliases.

## Personally verified on Preview

Playwright Chromium **159.0.8154.6**, Windows, Chrome mobile/touch emulation, DPR 1: **390×844 English** and **320×844 Arabic** on every PR. Manager matrix also inspected at **1440×900** in both languages. Real app authentication and existing hosted records were used. This is not physical-phone testing. [Machine-readable observations](results.json).

**Customer:** Two rapid touchscreen taps at the Add control produced quantity **2** and cart count **2** together ([English](19-390-en-quantity.png), [Arabic](19-320-ar-quantity.png)). After selecting and rotating Karak Corner, closing its sheet retained the angle and zoom ([sheet](19-390-en-sheet.png), [closed](19-390-en-map-closed.png)). The recorded residual angle change was 0.00012 radians, under 0.007 degrees, from damping when the canvas resized; zoom was unchanged and the camera did not reset. Opening an existing customer ticket, then refreshing, did not mount the receipt entrance ([reopened ticket](19-390-en-reopened-ticket.png)).

**Payment evidence is a controlled Preview response fixture, not a new MyFatoorah sandbox payment.** While the verify response was held, the screen said Verifying and never Paid ([capture](19-390-en-payment-verifying.png)). Awaiting and failed responses stayed unpaid; only an explicit `outcome: paid` verification response displayed Paid ([fixture capture](19-390-en-payment-fixture-paid.png)). Reopening verified again: four verify calls, zero payment-start calls. The server verification route was also inspected: authentication/ownership checks and gateway invoice/order/amount/currency settlement remain authoritative; URL parameters alone cannot mark an order paid. [Inherited MyFatoorah sandbox observations](https://github.com/YukonJR12/qafla/blob/7e351205f19109bea3cc0007ac400b22db73ebf5/docs/evidence/payments/preview-sandbox-run.md) cover older builds, including forged-success and mismatched-payment checks; they were not rerun for this PR.

**Vendor:** Selecting Classic smash's photo made **zero** generation calls ([photo awaiting action](20-390-en-photo-before-generate.png)). The current idle button is labelled **Suggest copy** and changes to Generating draft while pending. Two explicit generations returned controlled drafts. After confirming the first draft, generating/applying its replacement cleared allergen confirmation and disabled Save for customers ([English](20-390-en-replacement-unconfirmed.png), [Arabic](20-320-ar-replacement-unconfirmed.png)). An intercepted 503 price-save failure retained draft **2.100 KWD**, kept saved **1.950 KWD**, and exposed an enabled retry ([English](20-390-en-failed-save-retry.png), [Arabic](20-320-ar-failed-save-retry.png)). The retry was not sent to the hosted database; the existing local fixture suite covers successful retry. **OpenRouter was not exercised:** generation responses and the failed save were controlled Preview fixtures.

**Manager:** Used authenticated hosted history with simulated seed provenance for **21 November**, selecting **T03 Taco Saha · 8:00 PM**. At every replay step, and again after rewinding, checked all three KPI cards against the same selected-time calculation, the selected heatmap cell, the chart's observed/projected/range/capacity figures and the expanded mobile row. The row stayed expanded after booking closed. “Demo forecast · simulated history” remained visible.

| Replay time (Kuwait) | Booked / capacity | Projected | Range | Slots at risk | Expected new bookings | Busiest still-bookable window |
| --- | --- | --- | --- | --- | --- | --- |
| 7:00 PM | 5 / 6 | 6 | 5–6 | 9 | 35.3 | 8:00 PM · 32.3 / 43 |
| 7:15 PM | 5 / 6 | 6 | 5–6 | 9 | 37.1 | 7:30 PM · 29 / 38 |
| 7:46 PM, after 7:45 cutoff | 6 / 6 | 6 | 6–6 | 6 | 34.3 | 8:15 PM · 33.3 / 43 |
| Rewind to 7:00 PM | 5 / 6 | 6 | 5–6 | 9 | 35.3 | 8:00 PM · 32.3 / 43 |

The closed-slot comparison retains **original 7:00 PM prediction 6 beside final simulated count 6: absolute error 0 orders**. [English comparison](21-390-en-comparison.png) · [Arabic comparison](21-320-ar-comparison.png) · [original booking pace](21-390-en-prediction.png) · [rewound view](21-390-en-rewind.png) · [desktop matrix](21-390-en-desktop-matrix.png). The expected-bookings KPI covers the moving next-hour window, so it need not decrease between replay steps. No live OpenRouter request was made during this replay check.

## Reused recordings and checks

- [Customer normal-speed 390 px recording and 118 unit / 57 browser / 86 database results](https://github.com/YukonJR12/qafla/blob/7e351205f19109bea3cc0007ac400b22db73ebf5/docs/evidence/easyui-customer/README.md).
- [Vendor screenshots and 117 unit / 55 browser / 86 database results](https://github.com/YukonJR12/qafla/blob/0640cd04b9527ace85e7041f92fcdd01e71e2df5/docs/evidence/easyui-vendor/README.md).
- [Manager normal-speed replay, 117 unit / 86 database results and final 34 combined journey checks](https://github.com/YukonJR12/qafla/blob/c304fbde6d8f020e65ee5241db476b3f4b2db9e2/docs/evidence/easyui-forecast/README.md). The 43-test full browser run preceded two final chart-label corrections; the final combined run included those corrections.

Those recordings and broader English/Arabic 320/390/desktop, keyboard and reduced-motion tests used local production builds with controlled fixtures. They are inherited evidence, separate from the deployed observations above. All reported database test processes exited **0** without interruption. Lint, typecheck and production builds passed on the recorded application commits. No application code changed in this verification pass.

## Mobile JavaScript cost

Same Windows host, Node 24.15, pnpm 11.24 and lockfile, Next production build with the same public fixture environment. Gzip level 9 per unique route entry file plus its route-local dynamic imports. These are artifact bytes, **not transfer time or measured latency**. [Raw baseline, standalone and combined measurements](https://github.com/YukonJR12/qafla/blob/c304fbde6d8f020e65ee5241db476b3f4b2db9e2/docs/evidence/easyui-forecast/README.md).

| Build | Menu gzip bytes | Ticket gzip bytes |
| --- | ---: | ---: |
| Base main `53f593a` | 108,396 | 111,868 |
| PR19 | 109,108 (**+712 / +0.66%**) | 112,918 (**+1,050 / +0.94%**) |
| PR20 alone | 108,396 (unchanged) | 111,868 (unchanged) |
| PR21 alone | 108,396 (unchanged) | 111,868 (unchanged) |
| All three combined | 109,108 | 112,918 |

No new runtime dependency, and the forecast's lazy code is absent from menu/ticket imports. No blocking behavioral regression was observed in the exercised paths. The modest customer-route byte increase is the measured performance cost; physical-phone gesture feel and live provider integrations remain outside these checks.

## Bases and merge order

All three PRs target **main `53f593a409fbaa8a0973155bb04682edf9ed05b0`**, not one another. Rush Forecast **#17 is already merged** as `061eb1cfca121bf4d3d39c478c0f962ff5ff0dfb`, and that merge is an ancestor of this main. PR18's shared history work is also in main. PR21 uses that shipped foundation and has **no outstanding dependency on merging #17**.

Suggested review/merge order: **19 → 20 → 21**. This is an organizational order, not a stack requirement. Their application changes already merged locally without conflicts and passed the 34 combined journey checks. Recheck merge status after each eventual merge. No PR was merged or closed during this preparation.
