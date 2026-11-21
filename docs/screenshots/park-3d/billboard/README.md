# CODED billboard and smooth 360° orbit

The billboard is at the far end of the park, opposite the entrance, with two posts and a frame matching the supplied reference. Both faces use the original 2172 × 724 PNG unchanged. Source and repository artwork SHA-256: `117a9fb2005a06683854b629a770bd27f3e4a95887a85d22b54007ed3e249c92`.

Tapping the artwork navigates in the same tab to <https://coded.kw/bootcamps/ai-app-developer>. The equivalent native link has an English/Arabic accessible name and becomes visible on keyboard focus, without covering the artwork otherwise.

## Camera change

Removed the rotation handler that rewrote zoom and fought pinch gestures. Horizontal orbit is unrestricted; tilt and zoom remain bounded. Dragging uses damping, while selection/reset uses elapsed-time interpolation around the shortest orbit. Reset finishes at the exact original position and zoom. Reduced motion disables both animated movement and inertia. Rendering still stops once the camera settles.

At side-on angles the long plaza may extend beyond the screen at the current zoom; pinch out to see more. Rotation itself never changes the chosen zoom.

## Verified in the local production build

- **320 and 390 px, English and Arabic:** touch gestures traverse more than 360°, zoom stays unchanged throughout rotation, a two-finger pinch changes zoom, Reset restores the original angle/zoom, and WebGL draw calls stop after settling. Raw measurements are in `orbit-*.json`.
- **390 px English:** dragging from the artwork rotates without navigation; keyboard Reset returns to the default view; tapping the actual 3D artwork opens the exact supplied URL.
- **320 px English/Arabic and 390 px Arabic:** the localized native link activates with Enter.
- All six truck targets, their sheets, Ready → paused Dune Burgers, reduced motion, invalid IDs, keyboard truck list and unavailable/lost WebGL remain covered by the existing park cases.
- Lint, typecheck, production build, **108 unit tests**, **23 browser cases**, **83 isolated database checks** pass. Database process exits normally with code 0; no interrupt.

[390 px billboard/orbit recording](billboard-orbit-390-en.webm) shows a drag over the artwork, full orbits, pinch, Reset and a touch on the artwork. The destination is intercepted by the test harness and visibly marked **CODED destination fixture**; the URL is asserted, and no requests are sent to CODED during this browser test.

`billboard-*.png` shows all four default phone layouts; `reverse-*.png` captures an intermediate rotated view. The [updated original flow recording](../park-interaction-390-en.webm) shows Map → rotation → Karak Corner sheet → Ready ticket → paused Dune model with the billboard present.

Measured Map tap to usable scene in that updated recording: **1,620 ms (1.62 s)**, Windows desktop, Chromium **159.0.8154.6**, 390 × 844 touch emulation, ANGLE/SwiftShader software WebGL, no throttling. [Raw load measurement](../metrics.json). All browser data is an isolated fixture; shared Production/Preview data was not modified.

These are desktop-emulated checks, not physical iOS/Android or Safari measurements. Smoothness on the owner's actual phone remains part of visual approval. No signed-in deployed interaction or mobile-network timing is claimed here.
