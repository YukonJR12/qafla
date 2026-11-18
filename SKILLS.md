# Skills installed in this project

48 agent skills are installed in `.claude/skills/`. Each is a folder with a `SKILL.md`. Claude Code loads them at session start. This file says what each one is for and which to use when, so agents don't fight over the same job.

**Trigger column:**
- **auto**: the model may load it when the task matches its description.
- **`/name` only**: it runs only when someone types `/name`. It never loads by itself.
- **background**: the model loads it but users can't call it.

---

## 1. Routing rules for this project (read first)

1. **`DESIGN.md` is the visual authority.** Qafla already has a locked design system ("Qafla Pickup": Red Orange `#F42902`, Snowy White `#FDFDFF`, Yellow Punk `#C6F900`, poster lettering, ticket edges, bilingual EN/AR). No skill may replace it with its own palette, theme or "dealt" art direction unless the user asks for a redesign.
   - `design-taste-frontend` deals random directions, `hallmark` deals one of 50 themes, and `theme-factory` and `brand-guidelines` apply preset themes or Anthropic branding. In this project, use them only when the user asks for exploration. Otherwise they must defer to `DESIGN.md`.
   - `impeccable` and `hallmark` both read `DESIGN.md` and treat it as locked, which is the behavior we want.
2. **One lead design skill per task.** Pick one from section 2 and use the polish/review skills (section 3) as checklists under it. Don't load three build skills that each want to own the layout.
3. **Fixed seed data and security rules.** The app loads trucks and menu from `seed/`. Never put secret keys in the repo. Payments use test mode only. Skills that ask for API keys (Gemini, Together AI) are optional. Never commit a key they use.
4. **Size warning.** `.claude/skills/` is about 74 MB. Decide whether it belongs in the submission repo before the first commit (add it to `.gitignore` if not).

### Quick picker

| I need to… | Use |
| --- | --- |
| Build or restyle a screen in the Qafla look | `impeccable` (lead) + `make-interfaces-feel-better` |
| Add or fix shadcn/ui components | `shadcn` (+ `ui-styling` for Tailwind patterns) |
| Find a palette, font pairing, chart type or UX rule | `ui-ux-pro-max` (searchable local database) |
| Check a finished screen | `better-interface` (ranked report) or `/impeccable audit` |
| Review a diff or PR for UI regressions | `/interface-review` |
| Stress-test one component (long text, empty, errors, Arabic/RTL) | `/break`, then `/state-machine` |
| Try several versions of a component | `/variant` |
| Interface copy, errors, empty states | `better-writing` |
| Accessibility, focus, ARIA, WCAG 2.2 | `better-accessibility` |
| RTL, translation room, responsive structure | `better-layout` |
| Test the running app in a browser | `webapp-testing` (Playwright) |
| Build from a Figma file or screenshot | `build-design` |
| Work on the Claude API or AI feature | `claude-api` |
| Fill in the `templates/*.md` write-ups | `doc-coauthoring` |
| Presentation deck | `pptx` (.pptx file) or `slides` (HTML) |

---

## 2. Lead design and build skills (choose one per task)

| Skill | Trigger | What it does | Notes |
| --- | --- | --- | --- |
| `impeccable` | auto, `/impeccable [cmd] [target]` | Full design director: shape, critique, audit, polish, animate, layout, typeset, colorize, harden, onboard, optimize, adapt, plus `init`/`document`/`extract` for DESIGN.md. | **Preferred lead for Qafla.** Reads PRODUCT.md and DESIGN.md. First run downloads a checksum-verified engine binary from its GitHub releases (`scripts/impeccable.cmd` on Windows). |
| `hallmark` | auto for new builds, `/hallmark <prompt> \| redesign <path> \| audit <path>` | Designs before coding, deals one of 50 themes, lints with `sloplint` in a real browser. | Treats DESIGN.md as locked. Won't touch existing designs unless named. Optional `TOGETHER_API_KEY` for mock-up images. Its optional lint hook (`scripts/install-hook.mjs`) is **not** installed. |
| `design-taste-frontend` | auto | Taste Skill 2.5.1: art direction from 247 curated sites, real licensed photos, browser checker (`scripts/gate.mjs`, `inspect`). | Built for marketing/company sites, not app screens. Needs Node and local Chrome. A global skill with the same name exists. This project copy is newer. |
| `frontend-design` | auto | Anthropic's guidance for distinctive, non-template visual choices. | Light, general purpose. |
| `ui-ux-pro-max` | auto | Searchable database: 80 styles, 192 palettes, 74 font pairings, 25 chart types, 22 stacks, UX rules. | Good as a **reference** under another lead. Needs Python 3 (standard library only, no network). A global copy also exists. |
| `ui-styling` | auto | shadcn/ui + Tailwind building, theming, dark mode, accessible components. | Part of the UI/UX Pro Max set. |
| `build-design` | auto | Builds UI from a Figma file or image using existing tokens and components. | |
| `web-artifacts-builder` | auto | Multi-component claude.ai HTML artifacts (React, Tailwind, shadcn). | For artifacts, not the app itself. |

## 3. Polish and review skills (checklists under the lead)

| Skill | Trigger | What it does |
| --- | --- | --- |
| `make-interfaces-feel-better` | auto | Design-engineering details: hover states, shadows, borders, enter/exit animation, micro-interactions. Quick and full review modes. |
| `better-interface` | auto | Reviews a screen or flow across all the areas below and returns one ranked report. |
| `better-ui` | auto | Exact values for radius, optical alignment, shadows, icon states, motion. |
| `better-typography` | auto | Type scale, spacing, font features, wrapping, truncation, punctuation. |
| `better-colors` | auto | Palettes, semantic token names, format conversion, contrast checks. |
| `better-layout` | auto | Grouping, alignment, reading order, responsive structure, room for translation, mirroring (**RTL for Arabic**). |
| `better-accessibility` | auto | Keyboard and focus, ARIA, accessible names, forms, announcements, motion and zoom, against WCAG 2.2. |
| `better-writing` | auto | Labels, errors, empty states, confirmations in the product's voice. |
| `/interface-review` | `/name` only | Reviews a branch, PR or uncommitted change for UI problems it introduced. |
| `/break` | `/name` only | Renders one component in every scenario on a temporary page and stress-tests it. |
| `/state-machine` | `/name` only | Renders every state of a component with mock data and a switcher. |
| `/variant` | `/name` only | Builds several variants of a component to compare and pick. |
| `/explain-interface` | `/name` only | Explains how a site, effect or animation was built, from a URL or screenshot. |

## 4. Components and frameworks

| Skill | Trigger | What it does | Notes |
| --- | --- | --- | --- |
| `shadcn` | background | Adds, searches, fixes and composes shadcn/ui components, registries and presets. Activates when a `components.json` exists. | Runs `npx shadcn@latest info --json` on load and is **pre-approved** to run `shadcn` CLI commands without asking. Needs Node. |
| `migrate-radix-to-base` | auto | Migrates components or a whole project from Radix UI to Base UI. | Only if the project switches base library. |

## 5. Design systems, brand and visual assets

| Skill | Trigger | What it does | Notes |
| --- | --- | --- | --- |
| `hue` | auto, `/hue` | Turns a URL or screenshot into a new design-language skill (tokens, component library, previews). | Saves generated skills to **global** `~/.claude/skills/` by default. Ask for this project's folder if wanted. |
| `design-system` | auto | Three-layer tokens (primitive → semantic → component), CSS variables, scales, component specs. | |
| `design` | auto | Brand identity, tokens, logos, corporate identity, icons, banners, social images. | Logo, icon and identity image generation needs a Gemini (or similar) API key. Broad description, can trigger often. |
| `brand` | auto | Brand voice, messaging, visual identity, consistency reviews. | Broad description. |
| `banner-design` | auto | Social, ad, hero and print banners in many styles. | |
| `theme-factory` | auto | 10 preset themes for slides, docs, pages, or a generated theme. | Must not override DESIGN.md (see section 1). |
| `brand-guidelines` | auto | Applies **Anthropic's** brand colors and type. | Not for Qafla UI. |
| `canvas-design` | auto | Static posters and art as .png or .pdf. | |
| `algorithmic-art` | auto | Generative art with p5.js. | |
| `slack-gif-creator` | auto | Animated GIFs sized for Slack. | |

## 6. Documents, decks and data

| Skill | Trigger | What it does |
| --- | --- | --- |
| `pdf` | auto | Read, extract, merge, split, fill or create PDFs (e.g. reading the challenge PDF). |
| `docx` | auto | Create or edit Word documents. |
| `pptx` | auto | Create or edit PowerPoint decks (the presentation). |
| `slides` | auto | Strategic HTML presentations with Chart.js. |
| `xlsx` | auto | Spreadsheets and CSV/TSV (e.g. working with `seed/*.csv`). |
| `doc-coauthoring` | auto | Structured workflow for specs, decision docs and proposals (`templates/decisions.md`, `tampering_test.md`). |
| `internal-comms` | auto | Status reports, updates, FAQs, incident reports. |

## 7. Engineering, testing and workflow

| Skill | Trigger | What it does | Notes |
| --- | --- | --- | --- |
| `webapp-testing` | auto | Drives the local app with Playwright: checks behavior, screenshots, browser logs. | Python + Playwright. |
| `claude-api` | auto | Claude API and Anthropic SDK reference: models, tool use, streaming, caching, vision. | For the AI feature (menu descriptions, image/injection test). |
| `mcp-builder` | auto | Building MCP servers (Python FastMCP or TypeScript). | |
| `skill-creator` | auto | Create, edit and evaluate skills. | |
| `/upskill` | `/name` only | Studies past sessions on this project and proposes skills, hooks and automations. | |
| `/afk` | `/name` only | Works for hours while you're away and commits improvements to a local `afk/<date>` branch with a report. | Requires git (the project isn't a git repo yet). Never pushes unless asked. |
| `academy-guide` | auto | Points to Claude Academy courses for "how do I use Claude" questions. | |
| `discernment-nudge` | auto | Adds 2–3 check-your-assumptions questions after substantive advice, once per conversation. | |

---

## Sources

| Skills | Source |
| --- | --- |
| academy-guide, algorithmic-art, brand-guidelines, canvas-design, claude-api, discernment-nudge, doc-coauthoring, docx, frontend-design, internal-comms, mcp-builder, pdf, pptx, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing, xlsx | github.com/anthropics/skills |
| impeccable (v4.9.2) | github.com/pbakaus/impeccable (impeccable.style) |
| design-taste-frontend (v2.5.1) | github.com/Leonxlnx/taste-skill (tasteskill.dev) |
| hallmark (v2.0.0) | github.com/Nutlope/hallmark (usehallmark.com) |
| ui-ux-pro-max, ui-styling, design, design-system, brand, banner-design, slides (v2.15.0) | github.com/nextlevelbuilder/ui-ux-pro-max-skill (uupm.cc) |
| hue (v1.2.0) | github.com/dominikmartn/hue (hueapp.io) |
| shadcn, migrate-radix-to-base | github.com/shadcn-ui/ui (ui.shadcn.com/docs/skills) |
| afk, better-*, break, build-design, explain-interface, interface-review, state-machine, upskill, variant, make-interfaces-feel-better | github.com/jakubkrehel/skills, github.com/jakubkrehel/make-interfaces-feel-better (jakub.kr/skills) |

All were copied from their source repos into this project only. None of the sites' `npx` installers were run.
