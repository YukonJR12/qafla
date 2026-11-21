# Selectable pickup stages — PR #12

Verified on 21 November 2026. These captures use the actual customer ticket page
from a local production build, with a controlled fixture (`FIXTURE-000053`).
They are separate from the earlier screenshots and shared-database walkthrough.

- [10.76-second recording, 390 px English](preview-to-live-390-en.webm): touch
  previews change the explanation while the badge stays **Placed**; return to
  current; keyboard selection; then a mocked kitchen update moves the live
  order to Ready while Collected is selected.
- `preview-{320,390}-{en,ar}.png`: Ready selected, Placed remains confirmed.
- `live-ready-{320,390}-{en,ar}.png`: Ready is confirmed, preview has reset,
  first three steps completed, pickup notice shown, cancellation removed.

The actual current step stays black with a yellow icon. The selected preview
has a red ring and an explicit “Stage preview” heading. Arabic runs right to
left; its Collected label wraps at 320 px without clipping.

## Repeat the focused regression

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

The command builds and starts the app on port 3102 with a dummy localhost
Supabase URL. The test intercepts REST and Realtime traffic, supplies a fake
session, and refuses unexpected requests. It never connects to hosted Supabase.
The transport event makes the real `useLiveOrders` hook re-read the fixture;
the test does not directly set React state. Video pacing is deliberate in the
390 px English case. Screenshots and videos are written to `test-results/`.

All four cases passed: 320/390 px × English/Arabic. Each exercises all five
touch targets, Tab order, Enter and Space, return to current, a same-status
refresh that preserves the preview, and a Ready update while Collected is
selected. Assertions cover the badge, completed/current steps, cancellation,
pickup notice, target sizes, horizontal overflow and zero backend writes.
The stable polite live region changes once for Ready and does not change again
on a duplicate update. This checks announcement DOM semantics; it is not an
audio recording from a screen reader.

Other checks: lint, typecheck, production build, 106/106 unit tests, and 83/83
database checks. The database command exited **0** without an interrupt when
run outside the Windows sandbox (5.8 seconds). The sandbox run passed its
assertions but stalled during subprocess cleanup; the harness was unchanged.

Formal `/interface-review pr 12` remains an owner action: the local skill has
`disable-model-invocation: true`. This evidence is the independent verification,
not a formal interface-review result. PR #12 stays open for visual approval.
