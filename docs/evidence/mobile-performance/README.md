# Mobile performance, launch and sign-in artwork

[Watch the updated 13.88-second, normal-speed 390 px walkthrough](final-interaction/390-en-motion.webm) · [Storyboard](final-interaction/walkthrough-storyboard.png) · [Updated sign-in](final-interaction/390-en-motion-fresh-sign-in.png)

**Local production-build comparison. PR #16 stays open and draft.** Tested application: `e3d6220ff767bc16cd3a36e875b56cb6fb22807a`; base: `12870f381535368cb9b50059b2b835cf3c202277`. No orders, payments or Production changes. The existing protected-Preview access limitation remains; this uses the explicitly authorized local fallback.

## Corrected before-and-after timings

Medians in milliseconds across **three cold and three warm runs per build per journey**:

| Journey | Base cold | Candidate cold | Base warm | Candidate warm |
| --- | ---: | ---: | ---: | ---: |
| Open → usable sign-in | 2,915.8 | 2,494.1 | 489.2 | 624.1 |
| Open → usable returning Explore | 4,743.5 | 4,309.7 | 2,024.5 | 2,255.8 |
| Truck touch → usable menu | 1,179.5 | 926.6 | 767.6 | 404.8 |
| Add → quantity/cart update, next frame | 24.9 | 25.7 | 26.9 | 25.1 |

[Comparison JSON](comparison.json) · [All base observations](revision-base/results.json) · [All candidate observations](final-head/results.json).

Menu opening improved **21% cold and 47% warm** in this sample. Cold launch improved by 422 ms fresh / 434 ms returning. Add remains approximately 25 ms. **Tradeoff:** warm launch-to-usable was 135 ms slower fresh and 231 ms slower returning. These are three-run observations, not a guarantee across devices or backend load.

**Measurement correction:** the earlier table included Playwright locator polling in the menu/launch stopwatch, which could add hundreds of milliseconds after rendering. Both builds were re-run with the same corrected instrument: browser animation-frame timestamps mark the first visible, enabled destination control; menu starts at the truck's pointerdown event and ends at the first visible, enabled Add control. The automation only retrieves those timestamps. Add retains the original click → both counters present → next-animation-frame measurement (a DOM/paint proxy, not physical touchscreen latency or animation completion). Do not mix this table with the historical polling-based tables.

Same Windows machine, Node 24.15, Chromium **159.0.8154.6**, **Chrome mobile emulation 390 × 844 CSS px, DPR 1, touch enabled**, **150 ms RTT, 1.6 Mbps down, 750 Kbps up, CPU 4×**. Both used `next build` + `next start`, sequentially at **http://127.0.0.1:3103**. Each had one server warmup pass before final collection. Cold = new context and cleared browser HTTP cache; warm = the same context/cache reused. The same existing Customer B session and read-only Supabase backend were used. Backend caches and Internet latency remain uncontrolled. No build or browser suite ran alongside the timed collection. Vercel region-placement benefits are not measured by localhost runs.

## Launch: what changed and what is still visible

The complete official logo is now a 256 px WebP embedded in the server-delivered document (18,988 bytes before base64), rather than a separate image request followed by a hydration-dependent animation. The image is passed from the server layout, not duplicated in an application JavaScript bundle. Its CSS entrance begins on first paint, keeps its right-facing orientation in Arabic, and is static under reduced motion. A regression test blocks all application JavaScript and verifies the actual logo still paints without an image request.

Font preloads that competed with launch were removed; fonts load when used. The main stylesheet remains cacheable. Session restoration is not delayed and the ready destination mounts under a non-intercepting 180 ms handoff. There is no minimum launch timer.

Cold first-captured-logo medians, measured from document request start in Chrome trace screenshots:

| Entry | Base | Candidate |
| --- | ---: | ---: |
| Fresh | 1,041 ms | 837 ms |
| Returning | 1,050 ms | 835 ms |

[Paint observations and method](logo-paint.json) · [Fresh filmstrip](final-head/fresh-1-cold-filmstrip.png) · [Returning filmstrip](final-head/returning-1-cold-filmstrip.png) · [Logo visible with application JavaScript blocked](revision-ui/launch-without-javascript.png).

**This does not mean zero white before the first browser paint.** HTML/CSS still need to arrive over the throttled connection. The new video includes that initial browser interval (approximately 1.2 s including capture setup), without trimming it out. What is removed is the separate launch-image/hydration wait: the first branded frame already contains the complete logo, which rolls immediately instead of sitting left until application code loads. Screenshot sampling and video timestamps have different origins; the trace table uses the document request as its origin.

## Menu: live data with less competing work

The existing parallel truck/menu/slot/closure reads remain, with no availability cache. Explicitly disabling automatic prefetch on truck links avoids the preliminary route request before the usable response. Background navigation prefetches are also disabled so unopened Orders/Account routes do not occupy the network while the customer opens a truck. Explore dish photography has low fetch priority so navigation takes precedence on constrained connections. Image geometry and branding are unchanged.

This follows the supported [Next.js prefetch controls](https://nextjs.org/docs/app/guides/prefetching); the evidence, not prefetch alone, determined the change. The final menu navigation issues one truck-route request. No speculative menu data, prices or availability are served from a new client cache. Checkout/payment and account-scoped cart logic are unchanged.

[Base 3D-loading audit](revision-base/three-audit.json) · [Candidate audit](final-head/three-audit.json): each build loads 13 unique script chunks across the measured ordinary flows, with no Three/R3F signatures and no Map route or billboard texture requests.

## Supplied sign-in artwork

Replaced the old SVG line illustration with `/brand/qafla-account-art.png`. It is **byte-for-byte identical** to the supplied `Kuwait towers with a food truck.png` (1902 × 827); the existing Account asset is reused. No redraw, crop, recolour or mirrored artwork. Responsive image delivery preserves its proportions using `object-fit: contain`, with `alt=""`. The PNG occupies the right grid column, while the live sign-in/register title uses the chosen text direction on the left. The language control, title, underline, form and buttons remain live UI.

[320 English](revision-ui/sign-in-320-en.png) · [320 Arabic](revision-ui/sign-in-320-ar.png) · [390 English](final-interaction/390-en-motion-fresh-sign-in.png) · [390 Arabic](revision-ui/sign-in-390-ar.png). Tests also check registration mode, full image bounds, title/image separation, password controls and absence of horizontal overflow. Fixture screenshots use an explicit dummy password, not a demo-account credential.

## Updated walkthrough and checks

The **13.88-second original-speed clip** shows fresh launch → sign-in, a separate launch with a valid saved customer session → Explore, then Karak Corner → menu → one Add tap. No sign-in frame was observed during the English returning journey. Both dish quantity and cart count become 1 on that first tap. Credentials were obtained before recording and are not filmed. [Recording assertions](final-interaction/results.json).

[Arabic 320 menu](final-interaction/320-ar-motion-added.png) · [Arabic reduced motion](final-interaction/320-ar-reduced.webm). Both have 320 px scroll width and reachable cart controls; reduced-motion acknowledgement durations are 0 s. Physical-phone testing remains unverified; these are Chrome emulation checks.

Validation: production build, lint, typecheck, **108 unit tests**, **83 database checks with clean exit 0**, and **35/35 browser tests** at the final application commit, all passing. Controlled tests cover launch before JavaScript, fresh/returning/reduced launch, supplied artwork at 320/390 in both languages, live/repeated/reopened Ready, menu read concurrency, explicit payment choice and existing map/interface flows. Browser/DB fixtures are isolated from the shared hosted database.

The historical `before`, `before-fast`, `local-base` and `local-head` evidence is retained for audit, but the current table uses **revision-base / final-head only**. Reproduce with `scripts/measure-mobile.mjs`, `scripts/summarize-mobile.mjs`, `scripts/measure-logo-paint.mjs`, `scripts/record-mobile-motion.mjs` and `scripts/launch-filmstrip.mjs`. Credentials remain in the ignored private handoff selected with `PERF_HANDOFF`.
