# Cart and explicit payment review

Verified in Chromium touch emulation at 320 and 390 x 844, English and Arabic.
All captures use isolated local auth, menu, availability and order-response fixtures.
No shared database or real payment provider was used.

- Cart: supplied truck logos and dish photos, quantity controls, sticky total and checkout action.
- Checkout: four initial slots, expandable later times, selected later time remains visible after collapsing.
- No default payment choice. The bottom action focuses payment until a radio is explicitly selected.
- Keyboard Space selects online; pickup can be selected by touch. Choice persists across refresh.
- Both request payloads verified against intercepted refusals; no real order created.
- Build, lint, typecheck, 108 unit tests, four focused browser cases pass.
- 83 embedded PostgreSQL checks pass; process exits 0 naturally (about six seconds).

Phone hardware and a real payment transaction were not exercised. Existing explicit saved payment choices are retained.
