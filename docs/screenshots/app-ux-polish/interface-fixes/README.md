# PR #12 — interface review fixes

Verified on 21 November 2026 against the code in this commit, following the
formal review of `e28acd8`. These captures are from the actual pages in a local
production build, with a dummy localhost Supabase URL and intercepted responses.
No hosted database is contacted.

## Findings addressed

- **Arabic password overlap:** the shared password input/reveal-button wrapper
  now has `dir="ltr"`. Its button occupies the right-hand space reserved by
  the input in both languages. The surrounding page and labels remain RTL in
  Arabic. Sign-in and registration share this fix.
- **Account error feedback:** invalid-name errors focus the Name field after
  its linked error renders, including repeated local validation and a server
  `name_too_long` response. Form-level save failures use one stable atomic alert;
  a valid name is not marked invalid for a connection failure. Save retains
  keyboard focus while pending, prevents duplicate submission, and permits retry.

## Evidence matrix

Each pattern below has all four captures: `320-en`, `320-ar`, `390-en`, `390-ar`.

| Files | Verified state |
| --- | --- |
| `sign-in-*.png` | Revealed dummy password; eye and text separated |
| `sign-up-*.png` | Same field in registration, full scrollable form |
| `name-validation-*.png` | 61-character draft rejected locally, Name focused with linked error |
| `save-failure-*.png` | Mocked save failure, draft retained, Save focused and retry enabled |

[Stage-preview regression clip, 390 px English](stage-preview-regression-390-en.webm)
is a fresh recording from this run. It shows explanation changes while the
actual badge remains Placed, keyboard selection, and the isolated live Ready
transition resetting a preview. It uses `FIXTURE-000053`, not a real order.

## Checks

| Command | Result |
| --- | --- |
| `pnpm lint` | Pass, exit 0 |
| `pnpm typecheck` | Pass, exit 0 |
| `pnpm test:unit` | 106/106, exit 0 |
| `pnpm test:browser` | 12/12, exit 0; builds production app before running |
| `pnpm test:db` | 83/83, exit 0 in about 6.2 seconds, no interruption |
| `git diff --check` | Pass |

The eight new browser cases cover 320/390 px × English/Arabic for both findings.
They check touch and Tab/Enter/Space on the password reveal in both auth modes,
text/button geometry, repeated validation focus, zero RPCs for a 61-character
draft, server-side validation focus, a single alert text update for save failure,
focus retention while saving, duplicate-submit prevention, and successful mock
retry. The existing four pickup-timeline cases also pass unchanged.

The initial sandbox browser attempt could not locate Chromium in its redirected
cache and stalled during cleanup before any app interaction. The installed
browser suite passed outside the sandbox. The isolated embedded-Postgres test
also ran outside the sandbox so subprocess cleanup could finish normally.

Focus, accessible descriptions and live-region DOM changes are asserted; actual
screen-reader speech was not recorded. Shared-Preview profile saves, failed
payments and order updates were not performed. Preview verification and the
exact tested SHA are recorded in the PR description after deployment.

PR #12 stays open for Faisal's visual approval.
