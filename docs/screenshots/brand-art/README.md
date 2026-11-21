# Explore and Account artwork verification

The two supplied transparent PNGs are copied unchanged into `public/brand/`. Both are rendered directly with Next Image `unoptimized`, empty decorative alt text and `object-fit: contain`. No cropping, recolouring, mirroring, background treatment or rasterized UI text was added.

| Asset | Dimensions | SHA-256, identical to supplied source |
| --- | --- | --- |
| `qafla-park-art.png` | 1942 × 809 | `2464b1a34e060e3af6e465425e55373a00b82f3f4c03219bc1c045dc14741b9b` |
| `qafla-account-art.png` | 1902 × 827 | `af6b487a2f371cd6742ae399dba7fd9bac25cf52ddf2e4b865b20abd9c044cf0` |

Explore keeps the park title and pickup hours as live translated text on the left, with the complete two palms, three trucks and tower tips on the right. The physical arrangement and original artwork orientation remain fixed in Arabic.

Account keeps initials, name, email, role and Edit profile as live UI. The illustration sits on the right below Edit profile, with both tower tips and truck wheels inside the card. At phone widths the profile copy retains the full card width beneath the artwork, avoiding the narrow email column of the initial draft. At wider widths the copy sits alongside the artwork, matching the supplied reference. Long values wrap without entering the artwork area.

## Checked

Twelve screenshots cover **320, 390 and 720 CSS px × English and Arabic × Explore and Account**. The wider size checks the supplied Account reference composition. Explore's English title fits two lines at both phone widths. Captured on a local production build using Chromium 159.0.8154.6 with touch enabled.

Six temporary layout-verification cases passed. They checked successful original-PNG loading, `object-fit: contain`, no transform, image bounds inside each card, artwork on the right, no intersection with text, Account artwork below Edit profile and clear of the email, live title/hours/name, working profile dialog, and no horizontal overflow. Screenshots were also visually inspected for complete palms, trucks, wheels and tower tips. The temporary capture harness was removed after verification; permanent behavior regressions remain in the existing browser suite.

The capture used fake customer auth and isolated local read fixtures, including server-side Explore reads; no shared Production/Preview database writes were made. These are desktop touch-emulated layouts, not physical-phone captures.
