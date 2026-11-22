# Mobile performance and motion — local production-build comparison

[Watch the 14.4-second, normal-speed 390 px walkthrough](local-interaction/390-en-motion.webm) · [Storyboard](local-interaction/walkthrough-storyboard.png)

**Local fallback, not deployed timings.** Compared application builds `12870f381535368cb9b50059b2b835cf3c202277` (base) and `d5f47b4d3b9f621fa7f85cb3de2fca4382047917` (candidate). PR #16 remains draft for visual review. The candidate's [regular protected qafla-rjqd Preview](https://qafla-rjqd-rg0ew1yac-ffalrefae-6713s-projects.vercel.app) is Ready at d5f47b4 but redirects this unauthenticated session to Vercel sign-in. No share link was created and protection was not changed.

## Before and after

Medians in milliseconds, **three cold and three warm observations per build per journey**:

| Journey | Base cold | d5f47b4 cold | Base warm | d5f47b4 warm |
| --- | ---: | ---: | ---: | ---: |
| Open → usable sign-in | 3,123 | 3,131 | 535 | 604 |
| Open → usable returning Explore | 5,180 | 4,191 | 2,157 | 2,153 |
| Truck tap → usable menu | 1,409 | 1,402 | 883 | 895 |
| Add → quantity/cart update, next frame | 27.6 | 25.5 | 26.2 | 24.9 |

[Machine-readable comparison](comparison.json) · [All base runs](local-base/results.json) · [All candidate runs](local-head/results.json).

Returning cold launch was 989 ms faster in this sample. Menu latency was essentially unchanged, and fresh warm entry was 69 ms slower. **These results do not demonstrate a meaningful menu-speed improvement.** Add was already fast and remains fast. Three samples are descriptive, not a statistical guarantee; live backend variability remains. Local testing cannot validate the benefit of moving Vercel functions from Virginia to Singapore.

Both versions used `next build` + `next start` sequentially on the same Windows machine and **http://127.0.0.1:3103**, Node 24.15, Chromium **159.0.8154.6**, **Chrome mobile emulation** at **390 × 844 CSS px, DPR 1, touch enabled**, 150 ms RTT, 1.6 Mbps download, 750 Kbps upload, CPU 4×. No other browser suite or build ran during collection. Server assets were primed before final collection. Each cold run used a fresh browser context and cleared HTTP cache; its warm run reused that context/cache. Both builds used the same existing live Supabase backend and Customer B account. Backend caches and Internet latency to Supabase were uncontrolled. The Vercel region configuration does not affect these local servers.

Launch starts at navigation and ends when the real destination control is visible and enabled. Menu starts at the automated truck tap and ends when Add is visible and enabled. Add starts at the captured click event and ends at the next animation frame after both dish quantity and cart count are in the DOM: a DOM/paint proxy, not physical touchscreen latency or completion of the cart entrance animation. No orders, payments or hosted data changes were made; Add changes only the disposable local cart. Credentials and session tokens are excluded from evidence.

## Recording and actual frames

The original-speed video is 14.44 s, with no time compression:

- Approximately 0–4.5 s: cold fresh entry, white launch and official logo rolling right, then sign-in.
- Approximately 4.7–10.5 s: separate cold entry with an existing valid customer session; logo rolls and hands off to Explore without sign-in.
- Approximately 10.5–14.4 s: Karak Corner → usable menu → one Add tap → quantity 1 and View order (1).

The saved session is obtained before filming and installed in the disposable browser; credentials are not filmed. Browser-frame monitoring found **zero sign-in frames during the English returning journey**, and the first-tap assertion verified both counters equal 1. [Recording assertions](local-interaction/results.json).

Actual extracted frames show the fresh logo moving about 30 px between 2.75 and 3.25 s; the returning logo also moves right before settling. **Remaining visible limitation:** the cold recording begins with about 1.5 s of white before the image appears under this throttle. The logo can also sit at its left starting position while client code loads. Neither is hidden or edited out of the clip. No minimum launch timer was added; the destination becomes interactive while the departing layer fades without intercepting input.

[Fresh cold trace filmstrip](local-head/fresh-1-cold-filmstrip.png) · [Fresh warm filmstrip](local-head/fresh-1-warm-filmstrip.png) · [Returning filmstrip](local-head/returning-1-cold-filmstrip.png). Trace screenshot timestamps are relative to the first captured frame; warm traces can initially contain the previous page and can stop while the non-blocking handoff is still fading.

[Arabic 320 screenshot](local-interaction/320-ar-motion-added.png) · [Arabic 320 reduced-motion screenshot](local-interaction/320-ar-reduced-added.png) · [Reduced-motion recording](local-interaction/320-ar-reduced.webm). Both have scroll width 320 px, reachable cart controls and quantity/cart count 1. Reduced-motion acknowledgement durations are 0 s. Existing fixture checks verify a static launch and steady Ready notice. **No physical phone was available; physical-device performance is unverified.**

## Waterfall, trace and scope

Each raw-run directory contains `.network.json`, `.trace.json.gz` (decompress and import into Chrome Performance), `.frames.json` and screenshots. These contain no request headers/bodies. The supplied park artwork now arrives as a responsive image: a representative candidate cold request transferred **28,318 bytes**, versus the prior Production's unoptimized **412,840-byte** PNG. Its source artwork and contain layout are unchanged. In the local base journey the large artwork transfer could still be unfinished when navigation left Explore.

A representative warm menu's full RSC response took about 728 ms in base and 348 ms in the candidate, but the complete tap-to-usable measure did not materially improve. Additional route/prefetch requests and client work remain part of that journey; do not equate one faster response with a faster user interaction.

[Base 3D loading audit](local-base/three-audit.json) · [Candidate audit](local-head/three-audit.json): no Three/R3F signatures in the ordinary-flow script chunks and no Map route or billboard texture requests. Lazy loading is preserved.

The initial deployed baseline, collected before implementation, remains in [before/results.json](before/results.json) with traces and an [unthrottled warm-launch filmstrip](before-fast/fresh-1-warm-filmstrip.png). Those Production timings are **not** used as the before column above because their server environment differs from the local candidate.

Implementation: parallel menu/truck/slot/closure reads remove the duplicate truck query; sin1 collocates Preview functions with the database; responsive Explore artwork reduces transfer. Launch starts its entrance after image load, retains the complete official logo on #FDFDFF and fades without blocking a ready destination. Add retains one account-scoped cart update with pressed-state feedback. The confirmed Ready notice has one subtle entrance and contains Find my truck; repeated Ready updates and reopening an already-Ready ticket do not replay it. Stage previews do not affect confirmed status or write to the database.

## Checks and remaining review

The application at d5f47b4 passed lint, typecheck, production build, **108 unit tests**, **83 database assertions with successful exit 0**, and **34/34 browser tests**. Both local production builds also completed successfully for this comparison. No application code changed during evidence collection. Browser fixtures cover English/Arabic 320/390, reduced motion, live/repeated/reopened Ready, parallel reads, explicit payment selection and existing map/interface behavior. Account isolation and slot-full/truck-closed recovery contracts passed in unit/database tests; recovery was not re-driven in a hosted browser.

[Arabic 320 reduced-motion Ready fixture](fixtures/ready-ar-320-reduced.png) · [English 390 Ready fixture](fixtures/live-ready-390-en.png). These are controlled fixtures, not production tickets.

Remaining owner review: inspect the normal-speed clip and the cold white interval. Protected Preview end-to-end performance and physical-phone performance remain unverified. PR #16 stays open and draft; these results are not a merge recommendation.

Reproduction scripts: `scripts/measure-mobile.mjs`, `scripts/summarize-mobile.mjs`, `scripts/record-mobile-motion.mjs`, `scripts/launch-filmstrip.mjs`, `scripts/audit-map-loading.mjs`. `PERF_HANDOFF` points to an ignored private credentials file; do not commit it.
