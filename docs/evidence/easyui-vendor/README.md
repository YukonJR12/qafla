# Vendor interactions — EasyUI adaptations

[390 px English draft review](vendor-review-390-en.png) · [320 px Arabic draft review](vendor-review-320-ar.png) · [390 px saved result](vendor-saved-390-en.png)

Tested application commit: **03da133**. Local production build based on `53f593a`, Chromium **159.0.8154.6** on Windows. Chrome emulation at 320×844 and 390×844; desktop 1440×844, English and Arabic. Both 320 px photo/review journeys use reduced motion. Native checkbox keyboard operation is exercised. All database and AI responses in these browser scenarios are controlled fixtures; no Production edits or paid model requests.

## Source mapping

Adapted the MIT-licensed [EasyUI source at 1506593](https://github.com/Surajmaurya1/easyui/tree/15065930b3ee3991b4aece5713a6bfbca7a782f7/src/components/ui), [license retained](EasyUI-LICENSE). No dependency added.

| Component | Qafla placement | Adaptation |
|---|---|---|
| [Morphing Button](https://easyui.site/components/morphing-button) | `components/morphing-button.tsx`; price editor, capacity settings, kitchen ticket | Native button, reserved label dimensions, brief state transition, pending/success/retry labels and synchronous request guards. Success follows only a confirmed server response. Ready confirmation advances to the separately labelled Collect action. |
| [Animated File Upload](https://easyui.site/components/animated-file-upload) | Vendor dish editor photo area | Native picker, local thumbnail entrance, replace/remove, Generating draft state. Upstream's automatic/simulated upload is deliberately omitted: only the explicit suggestion action calls Qafla's server. Existing compression and server validation remain. |
| [DrawCheckbox](https://easyui.site/components/draw-checkbox) | `components/allergen-confirmation.tsx` | Actual labelled checkbox, native focus/Space behavior, CSS-drawn check. Generation, applying a replacement draft, description edits and allergen edits reset confirmation. |

## Observed results

- Six complete photo → generate → apply → keyboard-confirm → generate replacement → re-confirm → save journeys. Selecting/removing/replacing a photo alone produces **zero** AI requests and **zero** saves. Two explicit generations produce two fixture responses; one confirmed publish stores the second draft, once.
- Save is disabled until the current draft's allergens are explicitly confirmed. Replacement generation and replacement draft application clear confirmation.
- Failed price save retains `2.100` in the field and `1.950` as the saved value; explicit retry confirms `2.100`.
- Failed capacity update retains draft 7 and saved 6; explicit retry confirms 7.
- Failed Mark ready retains Preparing; explicit retry confirms Ready and exposes Mark collected. Each failed/retry pair makes exactly two requests; pending controls are disabled.
- Price button widths remain stable across pending and retry. The 320 px Arabic price control uses a full-width row so the longest label cannot create a tall narrow button.
- Inspected English and Arabic screenshots; automated horizontal-overflow checks pass at all six sizes/languages. Full-page captures include fixed navigation at the viewport position.

## Checks and route budget

Lint, typecheck, production build, **117/117 unit tests**, **55/55 browser tests**, **86/86 isolated PostgreSQL checks**. Database process exited **0**, without interruption. Reproduce focused cases with `pnpm exec playwright test tests/browser/vendor-interactions.spec.ts`.

Same build settings and gzip method as the customer PR. [Baseline](baseline-js.json) / [after](after-js.json): menu **108,396 → 108,396** gzip bytes, ticket **111,868 → 111,868**, forecast including lazy dashboard **123,817 → 124,044**. No forecast chart enters either customer route. Artifact sizes include shared runtime and are not transfer timings.

Not verified: physical-phone file picker behavior or a paid live AI call. Leave open for visual approval. Submission PR15 is unchanged.
