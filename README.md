# Qafla Truck Park · Starter pack

**CODED · Teaching Assistant technical challenge · AI App Developer**

Qafla is a fictional food-truck park. Every truck, dish and person in this pack is made up. Never add real customer data to this work.

## What is in the pack

| File | What it is |
| --- | --- |
| `CODED-TA-Technical-Assessment-AI-App-Developer.pdf` | The challenge itself: what to build, how it is checked, and the presentation. Read it first. |
| `owner_brief.md` | The park manager's brief: park hours, slots, order rules and what she cares about. Read it after the challenge PDF. |
| `seed/trucks.csv` | Six trucks: `truck_id`, `name`, `cuisine`, `default_slot_capacity`, `blurb`. |
| `seed/menu_items.csv` | 30 dishes: `item_id`, `truck_id`, `name`, `category`, `price_kwd`, `description`, `sold_out`. An empty `description` is for your AI feature to suggest. |
| `templates/decisions.md` | Template for your schema and access-control write-up. |
| `templates/tampering_test.md` | Template for your Tampering Test write-up. |
| `templates/submission.md` | Your links, demo accounts and the levels you reached. |
| `assets/menu-card-injection.png` | The test image for Level 3, step 2. |

## Submit

Reply to the same email thread, ahead of your presentation, with:

1. `submission.md`, filled in: your live link, your repo, your demo accounts and the levels you reached.
2. `decisions.md` and `tampering_test.md`, filled in, as Markdown (.md) files.
3. One screenshot per level you completed, plus the files and recordings each level asks for.

## Rules

- Load the trucks and menu from `seed/`. Keep the IDs, names and prices as they are.
- Never put a secret key in your repo, your screenshots or your submission. If one leaks, revoke it and make a new one.
- Use **test mode only** for payments. No real money, ever.
- Keep your app live until your presentation is over. The panel will run the Tampering Test on it themselves.

## Local development

Tested with **Node.js 24.15.0** and **pnpm 11.24.0** (Next.js needs Node 20.9 or newer). The app is Next.js 16 (App Router), strict TypeScript, Tailwind CSS 4 and ESLint 9.

```bash
pnpm install        # install dependencies from pnpm-lock.yaml
pnpm dev            # start the dev server at http://localhost:3000
pnpm lint           # ESLint
pnpm typecheck      # generate Next.js route types, then tsc --noEmit
pnpm build          # production build
pnpm start          # serve the production build (after pnpm build)
```
