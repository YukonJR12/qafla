# Mobile performance and motion

Status: implementation deployed to a protected Preview; comparable **after measurements and the hosted recording are pending Preview access**. Production is unchanged. Do not treat this as completed performance validation.

## Reproduction before editing

Baseline: Production `https://qafla-rjqd.vercel.app`, main `12870f381535368cb9b50059b2b835cf3c202277`. Implementation Preview: commit `c79b6b396eeb6f73667d99e6b1fa70e72d1b5b7c`.

Chromium 159.0.8154.6 on Windows, **Chrome mobile emulation**, 390 × 844 CSS px, DPR 1, touch enabled. CDP profile: 150 ms RTT, 1.6 Mbps down, 750 Kbps up, CPU 4×. Three cold/warm pairs for fresh and returning sessions. Cold means new context plus cleared HTTP cache; warm reuses that context/cache. Backend and CDN caches are uncontrolled. This is not a physical-phone benchmark.

Returning runs use the existing Customer B account in disposable contexts. Add modifies only the local cart. No orders or payments are created. Passwords, auth tokens and Preview access links are excluded from the committed evidence.

| Interaction | Cold median | Warm median | After |
| --- | ---: | ---: | --- |
| Open → usable sign-in | 3,965 ms | 1,267 ms | Pending |
| Open → usable returning Explore | 6,184 ms | 2,833 ms | Pending |
| Tap Karak Corner → usable menu Add | 2,437 ms | 2,424 ms | Pending |
| Add click → quantity and cart visible together, next paint | 27.2 ms | 47.0 ms | Pending |

[All baseline runs](before/results.json), [unthrottled diagnostic](before-fast/results.json). Launch ends when the destination's real primary control is visible and enabled; menu ends when Add is visible and enabled. Add starts at the captured click event and ends at the next animation frame after both quantity and cart exist. This does not measure physical touchscreen latency. Tap acknowledgement is separately provided by the pressed state.

## What the waterfall and trace showed

A representative returning cold run finished downloading root code around 2.7 seconds, then waited on account/profile restoration and the Explore response. The menu response was small (about 2.6 KB) but spent about two seconds waiting. Browser long tasks were comparatively small (94/70/66 ms in that cold trace; none in the corresponding warm trace). The bottleneck was server/data waiting, not Add rendering.

The menu awaited its truck query before starting menu, slots and closure reads; the closure helper fetched the same truck again. `fetchTruckMenu` now starts the four independent reads together, reuses the truck result, and preserves closure precedence and live availability. No availability caching was added. A focused held-promise test verifies that dependency removal.

Production functions were in `iad1`; the configured database is in Singapore. This branch's `vercel.json` places its functions in `sin1`, confirmed on the Preview deployment. This includes existing server routes, so checkout/payment regression checks remain relevant even though their logic is unchanged. Region placement is an intentional deployment difference in the upcoming comparison, not an identical server environment.

Explore also downloaded the supplied park artwork as a 412,840-byte unoptimized PNG. It now uses Next's responsive image delivery with the original artwork and contain layout preserved.

[3D bundle audit](before/three-audit.json): no Three/R3F signatures in the 13 JavaScript chunks downloaded by these ordinary flows; no Map route or billboard texture requests. Existing lazy loading is retained.

## Launch diagnosis and interaction changes

The original CSS entrance ran immediately, independent of image loading, and the splash unmounted as soon as restoration completed. Warm sign-in could remove it before the entrance settled; the module-wide once flag could also suppress later splash instances. The original animation was not universally absent. [Actual baseline warm frames](before-fast/fresh-1-warm-filmstrip.png) show its short travel and abrupt handoff. Frame labels are relative to the trace's first screenshot, which can still show the previous warm page; `img.complete` is a load signal, not proof that an image was not already partially painted.

The complete official logo now travels 32 px from the left on #FDFDFF, starting after image load, and eases once. Session restoration starts immediately. The destination mounts as soon as ready beneath a 180 ms fading layer with pointer events disabled; there is no minimum launch timer. Reduced motion keeps the logo static. Hosted first-frame confirmation remains pending.

Add now has immediate pressed-state feedback and a quantity acknowledgement. Quantity and cart still derive from the same existing account-scoped cart update; there is no extra request or optimistic database write.

The confirmed Ready notice has a subtle 6 px entrance and contains Find my truck. Repeated Ready events leave it steady; reopening an already-Ready ticket does not replay it. Previewing a future stage never creates a Ready notice or changes the confirmed status.

## Validation

- Lint and typecheck passed.
- 108 unit tests passed.
- 83 database assertions passed; **process exited successfully with code 0**, without an interrupt.
- Production build passed locally and on Vercel.
- Final full browser run: **34/34 passed**, exit 0. Covers fresh/returning launch, Arabic 320 reduced motion, live/repeated/reopened Ready, menu read concurrency, explicit payment choice, and existing map/interface checks at 320/390 in English/Arabic. Two initial new-test assertion failures were corrected before this final rerun.
- Account isolation and slot-full/truck-closed recovery contracts passed in unit/database tests; those recovery paths were not re-driven in a hosted browser.
- [Arabic 320 reduced-motion Ready fixture](fixtures/ready-ar-320-reduced.png), [English 390 Ready fixture](fixtures/live-ready-390-en.png), [Arabic 390 Ready fixture](fixtures/live-ready-390-ar.png). These are controlled local fixtures, not production tickets.
- Browser fixtures override the Supabase origin to localhost; ticket transitions and checkout tests do not write to the shared hosted database.
- Physical-device pinch and touch performance are unverified; no connected phone has been identified.

## Remaining evidence

- Identically profiled hosted after timings, waterfall and trace.
- Actual fresh/returning Preview first frames, including the fast warm handoff.
- Original-speed 390 px launch → Explore → menu → Add recording.
- Hosted Arabic 320 px screenshots and reduced-motion inspection.

Reproduce with `scripts/measure-mobile.mjs`; generate trace filmstrips with `scripts/launch-filmstrip.mjs`; record the hosted journey with `scripts/record-mobile-motion.mjs`. Credentials come from an ignored private handoff path via `PERF_HANDOFF`. Any approved temporary Preview access URL must be stored in an ignored local file, never passed into evidence or the PR.
