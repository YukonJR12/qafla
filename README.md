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

## Vendor kitchen board and live order status

`/vendor` is the kitchen board. A vendor signs in and sees tonight's tickets for their own truck, grouped by Kuwait pickup time, earliest first. Which truck is theirs comes from the database (`trucks.vendor_id`), and row-level security returns only that truck's orders.

| Where | What lives there |
| --- | --- |
| `app/vendor/page.tsx` | The board: header, "next pickup" line, one group per pickup time, finished tickets at the bottom. |
| `components/kitchen-ticket.tsx` | One ticket: pickup time, reference, quantities and dishes, the next action, and the reject dialog. |
| `lib/kitchen.ts` | The board's rules with no browser or database in them: the next status, grouping by time, what counts toward a slot. Unit-tested. |
| `lib/use-live-orders.ts` | The live connection both screens share. |

How a ticket moves: each button calls the database function `set_order_status`. The database decides whether this vendor may make this move (Placed → Accepted → Preparing → Ready → Collected, or Placed → Rejected with a reason). The board never changes a status by itself. It shows the status the database answered with. If no answer comes back, the ticket keeps its last confirmed status and the button becomes "Try again". A truck that is closed to new orders can still finish its tickets, because closing only stops `place_order`.

How the screens stay live: `orders` is in Supabase's Realtime publication, so the vendor board and the customer's open ticket are told when an order is added or changed. Realtime checks the same row-level security rule as a normal read, so each listener only hears about orders they may see. A live message is only a nudge. The screen then re-reads the saved order from the database, so it always shows what is saved. The same re-read runs when the connection comes back, when the tab is shown again and when the phone comes back online, so a missed message cannot leave a screen stale. While the connection is down, the last known status stays on screen with "Reconnecting…".

When the vendor taps "Mark ready", the customer's open ticket shows "Your order is ready for pickup" (`طلبك جاهز للاستلام`) with the truck's counter, and keeps showing it for as long as the order is ready.

Vendor accounts are not created in the app yet. See "Create the park manager and assign vendors" below. Screenshots are in `docs/screenshots/kitchen-handoff/`.

## Park manager dashboard

`/manager` is Dana's view of tonight across the park. From 768 px it is a grid: six trucks down, the 24 Kuwait pickup times across (5:00 PM to 10:45 PM), with the exact count in every cell, e.g. `5/6`. A cell is tinted from white toward pale orange as it fills, and a full cell is solid Red Orange with the word "Full". On a phone it is a time selector followed by six truck rows that read "5 of 6". Either way, one tap on a count opens the orders behind it.

| Where | What lives there |
| --- | --- |
| `app/manager/page.tsx` | The dashboard: busiest truck and time, the grid, the phone layout, and the selected slot. |
| `components/park-slot-detail.tsx` | One truck at one time: the count, whether it can still be booked, the tickets that add up to the count, and "Close for tonight". |
| `lib/park.ts` | The dashboard's rules with no browser or database in them: the 24 slots, the booking deadline, why a slot can or cannot be booked, which tickets count. Unit-tested. |

Where the numbers come from: the count in each cell is the database function `slot_usage`, the same one the customer's slot picker uses. The tickets listed under a count are read from `orders`, which row-level security returns in full only to the manager's account. The screen lists every order except rejected and cancelled ones (so collected orders stay in), shows the rejected and cancelled ones apart as "Not counted", and says whether the list adds up to the count. If the two ever disagree, an order changed between the two reads, and the screen reads again.

"Places taken" and "Booking" are two separate lines. A time can have a free place and still be closed for booking, because its deadline (15 minutes before pickup) has passed. That reads "Booking closed at 7:00 PM … This time is not full", which is different from "Full".

"Close for tonight" names the truck and explains that new orders stop while the kitchen can still finish its tickets. "Keep open" closes the dialog and changes nothing: the same truck and time stay selected (they are kept in the page address, so a language switch or a reload keeps them too). Confirming calls the database function `close_truck_for_tonight`. The truck is shown as closed only after the database answers with the saved closure. The database refuses that call from any account that is not the park manager, whatever the screen shows. A closure lasts for the Kuwait service date; there is no "reopen" in the app.

The dashboard is live the same way the kitchen board is: any new order or status change in the park is a nudge to re-read. The manager role is given in the database only. See "Create the park manager and assign vendors" below. Screenshots are in `docs/screenshots/manager-dashboard/`.

## Database

The data rules live in Postgres, in `supabase/`, so they hold no matter what a browser sends.

| Path | What it is |
| --- | --- |
| `supabase/migrations/…_schema.sql` | Tables and row constraints: profiles, trucks, menu items, closures, orders, order items. |
| `supabase/migrations/…_access_rules.sql` | Grants and row-level security: who can read and write which rows. |
| `supabase/migrations/…_order_functions.sql` | `place_order`, `set_order_status`, `close_truck_for_tonight` and `slot_usage`. Orders can only be created or changed through these. |
| `supabase/migrations/…_order_request_id.sql` | One order per customer per request ID, so a retry returns the same ticket. |
| `supabase/migrations/…_abandon_order_attempt.sql` | `abandon_order_attempt` and the shared lock that settles "place" against "give up". |
| `supabase/migrations/…_orders_realtime.sql` | Adds `orders` to the Realtime publication so the board and the ticket update live. Access rules are unchanged. |
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

Run every file in `supabase/migrations/` in filename order, then `supabase/seed.sql`. Either paste each into the Supabase SQL editor, or use the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push --include-seed
```

The migrations and the seed have been applied to the project's development Supabase project. Never run anything from `tests/db/` on a Supabase project.

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
