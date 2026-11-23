# Qafla 3D park — verification evidence

Built on merged PR #12 (`2ae1aee`). This folder belongs to the tested source commit that contains it.

Updated with the supplied CODED billboard and smooth 360° orbit. [Billboard recording, screenshots and gesture checks](billboard/README.md).

## Recording and performance

[390 px interaction recording](park-interaction-390-en.webm) shows Map opening, the park rotating to reveal the trucks’ sides, selection through Karak Corner’s attached touch label, its information/menu sheet, then a **Ready Dune Burgers ticket** opening directly on the Dune model. Dune is paused for new orders in this fixture. The recording finishes with pinch zoom, Reset view and the WebGL-loss fallback.

**Map tap to usable scene: 1,620 ms (1.62 s)** in the recorded run, including the billboard texture.
- Windows desktop; Headless Chromium **159.0.8154.6**.
- 390 × 844 CSS px, touch enabled; **SwiftShader software WebGL** through ANGLE/Vulkan.
- Actual Next.js production build on localhost; fresh browser context, no network/CPU throttling, mocked API responses.
- Measurement starts immediately before the Map tap and ends when the canvas reports its first rendered frame with all model and billboard textures loaded. It includes navigation, API reads, lazy JS import and texture loading, plus test observation overhead.
- This is a local desktop observation, **not a physical phone or deployed-network benchmark**. Raw browser/renderer information is in [metrics.json](metrics.json).

## What is implemented

- Six volumetric models mapped directly to `T01`–`T06`. Wheels, cabs, service windows/counters, striped awnings and the existing approved WebP logos. Distinct colours and rooftop silhouettes: tea cup, burger, taco, noodle bowl/chopsticks, saj chimney/dome, and lugaimat.
- Entrance arch with the approved Qafla logo; picnic tables, palm trees, paving and emissive walkway bollards. Ground contact shadows use low-cost translucent discs; no shadow-map or postprocessing pass.
- Elevated entrance-facing camera, full 360° horizontal orbit with damping, independent pinch zoom and Reset view. Selection highlights the truck and moves toward it; the sheet occupies layout space so it cannot cover the selected model. Reduced motion moves directly and disables inertia.
- CODED billboard at the far end of the park, using the supplied artwork unchanged on both faces. Tapping the artwork opens the supplied bootcamp URL in the same tab; a localized native link appears on keyboard focus.
- Physical positions stay fixed in both languages; controls and labels localize/mirror.
- Shared `fetchTrucksTonight` availability/next-pickup logic, refreshed every 30 seconds and on focus/visibility return. Paused/closed trucks remain locatable.
- Ready-only `Find my truck` link uses the order’s confirmed truck ID. No kitchen/order mutation is performed.
- Three.js/R3F load only on Map. Shared primitive geometry/materials, capped pixel ratio (1.5), demand rendering and an idle draw-call assertion.
- Existing searchable TruckList remains available for keyboard navigation, no-WebGL devices, scene errors and context loss.

## Checks

| Check | Result |
| --- | --- |
| Lint / typecheck | Pass |
| Production build | Pass, rebuilt by browser suite |
| Unit tests | 108/108 |
| Browser tests | 23/23, including 11 park cases and the prior 12 form/ticket regressions |
| Isolated database checks | 83/83, exit 0 in approximately 6.2 seconds; no interruption |
| Diff whitespace check | Pass |

At **320 and 390 px in English and Arabic**, every default-view truck label is a visible, at-least-44 px touch target and opens its matching sheet in one tap. Tests cover rotation without accidental selection, selected-label clearance above the sheet, correct menu links, Ready → paused T02, keyboard list access and no horizontal overflow. Other cases cover unsupported WebGL, context loss, invalid IDs, reduced motion, two-finger zoom and rendering stopping when settled.

`park-*`, `rotated-*`, `selected-*`, and `ready-truck-*` contain all four viewport/language combinations. `karak-sheet-390-en.png` and `ready-dune-390-en.png` are from the recording.

## Isolation and limits

The browser harness uses fake auth and intercepted REST/Realtime with a dummy localhost Supabase URL. External requests are blocked. `slot_usage` is a read-only RPC. No shared database order, profile, vendor setting or payment is changed; the Ready ticket is `FIXTURE-READY-T02`.

Actual iOS/Android hardware, Safari, screen-reader speech and deployed mobile-network latency were not measured. The scene is an authored representation of this fictional park, not surveyed coordinates. Both mesh picking and attached truck-label controls are implemented; the repeatable recording uses the labels. Earlier experimental recordings that clicked guessed pixels were discarded.

Shipped in PR #13 (main commit 672d567). This is historical fixture evidence for the shipped Park Guide; see ../../../submission.md for submission readiness and remaining assessment gaps.
