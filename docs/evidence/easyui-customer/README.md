# Customer interactions — EasyUI adaptations

[Normal-speed 390 px recording](customer-390.webm)

Tested application commit: **4a910a7**. Environment: local **production build** based on `53f593a`. Playwright Chromium **159.0.8154.6**, Windows, Chrome mobile emulation at 320×844 and 390×844; desktop 1440×844. Controlled HTTP, auth, order and payment fixtures; no hosted database writes or gateway payments. This is not physical-phone verification.

## Source mapping

All six interactions adapt the MIT-licensed [EasyUI source at 1506593](https://github.com/Surajmaurya1/easyui/tree/15065930b3ee3991b4aece5713a6bfbca7a782f7/src/components/ui), with [license retained](EasyUI-LICENSE). Qafla uses native React and CSS instead of adding Framer Motion. Existing Qafla tokens and operational data remain authoritative.

| EasyUI source | Qafla implementation | Treatment |
|---|---|---|
| [PressButton](https://easyui.site/components/press-button) | `quantity-stepper`, `menu-list`, `.tap-ack` | Adapted press compression; reused PR16 feedback. Removed redundant count/bar animations. Functional quantity updates and a stable control row preserve two taps at 320 px. |
| [Animated Tabs](https://easyui.site/components/animated-tabs) | `app-nav` | Adapted shared sliding underline to real route links and actual RTL coordinates. |
| [Sheet](https://easyui.site/components/sheet) | `truck-sheet`, Map | Adapted handle-only drag, threshold, Escape and visible close; nonmodal to preserve map gestures, focus and camera. |
| [Payment Receipt Printer](https://easyui.site/components/payment-receipt-printer) | checkout marker, `ticket-card` | Adapted brief receipt translation; no opacity/typing delay. Account-scoped, consumed once per newly placed order. |
| [Payment Status](https://easyui.site/components/payment-status) | payment return page | Adapted outcome icon/check and explicit verifying/pending/paid/failed states. Server verification remains authoritative. |
| [Stepper](https://easyui.site/components/stepper) | `pickup-timeline` | Adapted connecting fill/check motion to saved status; preview changes only explanation. |

## Personally exercised

- Full menu → two rapid taps → cart count 2 → explicit pickup payment choice → one fixture order with quantity 2 → ticket, in English/Arabic at 320, 390 and 1440 px. Additional 320 Arabic reduced-motion run.
- First ticket entrance once; refresh and Back show immediately. Future Ready preview retains Placed and cancellation. Existing tests cover live Ready transition, announcement and persistent Find my truck.
- Actual route links, Back and RTL underline position checked. Map sheet Escape and touch dismissal restore focus while preserving angle/zoom. Existing four-locale/width map and Ready deep-link tests passed.
- Verifying cannot display Paid; controlled pending, failed and server-confirmed paid responses in all six viewport/language combinations. Reopen performed verification only: zero payment-start calls or new orders.
- Inspected the 320 Arabic menu and 390 English ticket screenshots; no clipped controls, stage labels or horizontal overflow. Full-page screenshots include fixed bars at the capture viewport position.

## Checks

`pnpm lint`, `pnpm typecheck`, production build, **118/118 unit tests**, **57/57 browser tests**, **86/86 isolated PostgreSQL checks**. Database runner exited **0**, without interruption. Browser scenarios and readable recordings are reproducible in `tests/browser/customer-interactions.spec.ts`.

## Production JavaScript budget

Same Windows host, Node/pnpm lockfile, Next production build, local fixture environment. Unique route entry files plus route-local lazy imports, gzip level 9 per file. These are build artifact sizes, not network latency. [Before](baseline-js.json) / [after](after-js.json), reproducible with `scripts/measure-route-js.mjs`.

| Route | Before gzip bytes | After gzip bytes | Change |
|---|---:|---:|---:|
| Menu | 108,396 | 109,108 | +712 |
| Ticket | 111,868 | 112,918 | +1,050 |
| Forecast including its lazy dashboard | 123,817 | 124,512 | +695 |

Menu and ticket manifests have no forecast dynamic import. No new runtime dependency. Forecast retains its existing separate lazy route chunk.

Not verified here: physical-device touch feel or live MyFatoorah transactions. This PR remains open for visual approval; PR15 submission evidence is untouched.
