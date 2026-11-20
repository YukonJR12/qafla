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

## Customer ordering

One customer journey works end to end against Supabase:

`/` welcome → `/explore` → `/trucks/T02` menu → `/cart` → `/checkout` (pickup time, pay at pickup) → `/orders/<id>` ticket.

To run it, copy `.env.example` to `.env.local` and fill in the project URL and publishable key. Only those two public values are used by the app.

| Where | What lives there |
| --- | --- |
| `app/` | One folder per screen. Explore and the truck menu are rendered on the server from live data. Cart, checkout, sign-in and the ticket run in the browser. |
| `components/` | Shared pieces: header, language switch, quantity stepper, menu list, saved-cart notice, icons and buttons. |
| `lib/money.ts` | The one formatter for prices: `3.200 KWD` in English, `3.200 د.ك.` in Arabic. |
| `lib/time.ts` | Kuwait time and pickup-slot formatting (`7:15 PM`, `7:15 م`). |
| `lib/i18n.ts` | Every English and Arabic string, plus Arabic display labels for the seed trucks and dishes. |
| `lib/cart.tsx` | The cart, kept in the browser's `localStorage` so it survives refresh, language switch and sign-in. It stores item IDs and quantities, never prices. |
| `lib/data.ts`, `lib/supabase.ts` | Reads from Supabase and the two clients (signed-out for public data, signed-in for the customer). |

How an order is placed: checkout calls the database function `place_order` with the truck ID, the pickup time and a list of item IDs and quantities. The database prices the order, checks the truck, the time and the slot, and saves it. The ticket page then reads the saved order back by its ID, so refreshing it never places another order.

What happens when the answer is lost: every "Place order" carries a request ID, and the database keeps one order per customer per ID. Just before sending, the browser writes the attempt down for that signed-in customer (`lib/pending-order.ts`). If no clear answer comes back, checkout shows "We haven't confirmed your order yet" before anything else and keeps the same request ID. "Check my order" asks the database whether the order exists. It only reads, so it can never place an order. If the order is there, its ticket opens. If it is not there yet, nothing is unlocked, because the request may still be on its way. "Go back to checkout" is the way out: it calls `abandon_order_attempt`, which takes the same lock as `place_order` for that customer and request ID. Whichever gets there first wins. If the order was saved, the customer gets its ticket. If not, the attempt is recorded as abandoned and a late copy of the request is refused, and only then can the customer choose a time and order again. Another customer on the same browser never sees the attempt. Unit tests for this run with `pnpm test:unit`.

Screenshots of the flow, in English and Arabic, are in `docs/screenshots/customer-ordering/`.

## Database

The data rules live in Postgres, in `supabase/`, so they hold no matter what a browser sends.

| Path | What it is |
| --- | --- |
| `supabase/migrations/…_schema.sql` | Tables and row constraints: profiles, trucks, menu items, closures, orders, order items. |
| `supabase/migrations/…_access_rules.sql` | Grants and row-level security: who can read and write which rows. |
| `supabase/migrations/…_order_functions.sql` | `place_order`, `set_order_status`, `close_truck_for_tonight` and `slot_usage`. Orders can only be created or changed through these. |
| `supabase/migrations/…_order_request_id.sql` | One order per customer per request ID, so a retry returns the same ticket. |
| `supabase/migrations/…_abandon_order_attempt.sql` | `abandon_order_attempt` and the shared lock that settles "place" against "give up". |
| `supabase/seed.sql` | The six trucks and 30 dishes. Generated from `seed/*.csv`; do not edit by hand. |
| `scripts/build-seed.mjs` | Rebuilds `supabase/seed.sql` from the CSVs. |
| `tests/db/` | Database tests. `supabase-shim.sql` and `test-clock.sql` are for the test database only. |

### Test the database locally

No Supabase project, Docker or keys are needed. The tests start a throwaway PostgreSQL 17 server in a temp folder, apply the migrations and seed, run, and delete it.

```bash
pnpm test:db          # check seed.sql matches the CSVs, then run the database tests
pnpm db:seed:build    # rewrite supabase/seed.sql after changing a CSV
```

### Apply to a Supabase project

Run the three files in `supabase/migrations/` in filename order, then `supabase/seed.sql`. Either paste each into the Supabase SQL editor, or use the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push --include-seed
```

This step has not been run against a hosted project yet; so far the migrations are verified on the local test database only. Never run anything from `tests/db/` on a Supabase project.

### Create the park manager and assign vendors

Nobody can become the manager, or take a truck, through the app. After the person has signed up, run this in the SQL editor:

```sql
-- Make an existing account the park manager.
update public.profiles set role = 'manager'
where id = (select id from auth.users where email = 'dana@example.com');

-- Give a vendor account its truck (one truck per vendor).
update public.trucks set vendor_id = (select id from auth.users where email = 'vendor@example.com')
where id = 'T02';
```
