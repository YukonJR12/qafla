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

## Sign-in first, and getting around

Nobody uses the app signed out. Opening it shows the Qafla logo while the browser restores its saved session, and then:

| Who | Where they land | Their navigation |
| --- | --- | --- |
| Nobody signed in | The one sign-in screen (English or Arabic). | None until they sign in. |
| Customer | Explore | Explore, Orders, Account. The cart stays within reach on Explore and on a menu. |
| Vendor with a truck | Kitchen | Kitchen, Menu, Capacity, Account. |
| Vendor with no truck assigned | A screen that says so, with "Check again" and "Sign out". | None. |
| Park manager | Park overview | Overview, Slot details, Account. |

On a phone the navigation is a bar across the bottom. From 768 px it moves to a bar across the top with the Qafla logo, and the page uses the full width (the menu gets a cart summary beside it from 1024 px).

| Where | What lives there |
| --- | --- |
| `lib/routes.ts` | The rules, with no browser or database in them: each role's home, which screens it may open, where a sign-in returns to. Unit-tested. |
| `lib/account.tsx` | Who is signed in. It restores the Supabase session, then reads the role, the name and (for a vendor) the truck from the database. |
| `components/session-gate.tsx` | The launch gate. It shows the logo, sends people to sign-in or to their workspace, and draws the navigation. |
| `components/app-nav.tsx` | The bottom bar and the desktop top bar. |
| `app/orders/page.tsx` | Orders: tonight's unfinished orders first, then past orders. Each one reopens its live ticket (`/orders/<id>`). |
| `app/account/page.tsx` | The account, the language and "Sign out". |
| `lib/cart-store.ts` | Where the cart is kept: one storage key per account. Unit-tested. |
| `lib/images.ts` | Which truck logo and dish photo belongs to which seed ID. |

**The role comes from the database.** The gate reads `profiles.role` for the signed-in account and never trusts anything stored in the browser. It only chooses which screen to show. What an account can read or change is still decided by the database (row-level security and the order functions), so typing another role's address shows nothing that role's data. A signed-in user who opens another role's screen is sent to their own home.

**Creating an account.** Sign-in is one email and password form for everyone. "Create an account" asks one extra question: Customer or Truck vendor. The choice is sent with the signup and the database's signup trigger saves the role; it accepts `customer` or `vendor` and turns anything else into `customer`. The app then routes from the saved profile. A new vendor has no truck until the park assigns one (see "Create the park manager and assign vendors"), so they land on the "No truck is assigned" screen. The manager role is only ever set in the database.

**Returning to a link.** A signed-out visitor who opens a page, for example their pickup ticket, is sent to `/sign-in?next=…`. After sign-in they go back to that page if their role may open it, and to their own home if not. The address must be a plain page inside the app; anything else is ignored.

**Several people on one phone.** Each account has its own cart (`qafla.cart.v2.<account id>`) and its own unconfirmed checkout attempt (`lib/pending-order.ts`), and both also name their owner. Signing out ends the session in this browser only and returns to a clean sign-in screen. The next person starts from their own home with their own cart and orders, and every screen is rebuilt from nothing for them. A cart is not deleted on sign-out, so it is there when its owner signs in again. It holds dish IDs and quantities only. The cart that every visitor used to share (`qafla.cart.v1`) had no owner, so it is removed instead of being handed to whoever signs in next.

**Pictures.** The Qafla logo is the app's identity on the launch screen, sign-in, Explore, Account and the desktop bar. Each truck's own logo is on Explore, on its menu and in Orders, and each dish has its supplied photo. The originals were resized to WebP (`public/trucks/logos/`, `public/dishes/`, under 1 MB in total). Dune Burgers' logo was supplied on a cream background, which was cut away to match the others; its Classic smash photo is also the picture on the Explore poster.

**Motion.** Three short animations, 180 ms each: the logo arriving, the cart count when a dish is added, and the status when an order moves on. With "reduce motion" switched on they do not play.

Screenshots are in `docs/screenshots/sign-in-first/`.

## Launch, navigation and everyday screens

**Launch.** `components/splash.tsx` is the one launch screen. The server renders it, so it is the first frame: the whole viewport in Red Orange with the complete Qafla logo on a white tile. It is shown only while the app works out who is signed in and where they belong (`components/session-gate.tsx`, `lib/routes.ts`), and leaves the moment that is known. There is no timer. The truck rolls forward and settles once per page load; the logo image is drawn twice and each copy is clipped to its part, so the truck moves and the wordmark stays still without editing the artwork. If the wait passes 0.7 s, three dots appear. With reduced motion the logo is static. Moving between screens inside the app never plays it again.

**Where each role lands.** Unchanged rules, from the database profile: a customer on Explore, an assigned vendor on Kitchen, the manager on Park overview, an unassigned vendor on a screen that says so with Check again and Sign out. A page that was asked for before signing in (a pickup ticket, a staff screen) is opened afterwards if that role may open it.

**Explore.** Each truck row reads: logo, name and cuisine; three of its dishes; whether it is taking orders and the next pickup; "See menu". The whole row is one link. The photos come from `truckDishPhotos` in `lib/images.ts`, which uses the dish IDs (T03's dishes are M301 to M305), so there is no second list to keep in step. `components/scroll-memory.tsx` puts a customer back where they were in the list when they return from a menu. It remembers in memory only, so a fresh launch starts at the top.

**Orders, Account, bottom bar.** The active pickup's card ends in an "Open live ticket" button. On Account the email has the full width. The phone's bottom bar marks the current destination with its icon on an ink pill and a bold label. On a live ticket, "Ready for pickup" draws attention once, only if it turns ready while the ticket is open; reopening a ready ticket shows the notice already in place.

Dune Burgers now has its logo and five dish photos like the other trucks (`public/trucks/logos/T02.webp`, `public/dishes/M201.webp` to `M205.webp`). Screenshots and a recording are in `docs/screenshots/app-ux-polish/`.

## Customer ordering

One customer journey works end to end against Supabase:

sign in → `/explore` → `/trucks/T02` menu → `/cart` → `/checkout` (pickup time, pay at pickup) → `/orders/<id>` ticket.

To run it, copy `.env.example` to `.env.local` and fill in the project URL and publishable key. Only those two public values are used by the app.

| Where | What lives there |
| --- | --- |
| `app/` | One folder per screen. Explore and the truck menu are rendered on the server from live data. Cart, checkout, sign-in and the ticket run in the browser. |
| `components/` | Shared pieces: header, language switch, quantity stepper, menu list, saved-cart notice, icons and buttons. |
| `lib/money.ts` | The one formatter for prices: `3.200 KWD` in English, `3.200 د.ك.` in Arabic. |
| `lib/time.ts` | Kuwait time and pickup-slot formatting (`7:15 PM`, `7:15 م`). |
| `lib/i18n.ts` | Every English and Arabic string, plus Arabic display labels for the seed trucks and dishes. |
| `lib/cart.tsx`, `lib/cart-store.ts` | The signed-in account's cart, kept in the browser's `localStorage` so it survives a refresh and a language switch. It stores item IDs and quantities, never prices. |
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

## Customer pickup ticket: timeline, cancelling, rating

The ticket page (`/orders/<id>`) follows one order from "placed" to "collected".

| Where | What lives there |
| --- | --- |
| `components/pickup-timeline.tsx` | The five-stage timeline under the pickup time and truck name. |
| `components/ticket-actions.tsx` | "Cancel order" with its confirmation, and the rating form. |
| `lib/ticket.ts` | The ticket's rules with no browser or database in them: which stage is done or current, when cancelling and rating are offered. Unit-tested. |
| `supabase/migrations/…_order_ratings.sql` | The `order_ratings` table and the `rate_order` function. |

**Timeline.** Placed → Accepted → Preparing → Ready → Collected. It is drawn from the confirmed order status only, so it never runs ahead of the database. A finished stage has a check, the current stage has a Red Orange ring, and one caption says what is happening ("Dune Burgers is preparing your order."). Under 480 px the five markers are shown with that one caption; wider screens also print the stage names. The row follows the page direction, so it runs right to left in Arabic. The Yellow Punk notice still appears at Ready. A cancelled or rejected order has no timeline: it shows its own final message, with the truck's reason when it was rejected.

**Cancelling.** While the order is "placed", the customer can cancel it after confirming. The ticket calls the existing `set_order_status`, which locks the order, so a cancellation and the vendor's "Accept" cannot both succeed. Whichever the database saves first wins, and the ticket shows that outcome: either "You cancelled this order", or "Dune Burgers had already moved your order, so it wasn't cancelled." A cancelled order stops counting toward its pickup time (the existing counting rule), which frees exactly one place. The vendor board and the manager dashboard are told by the same live update as any other status change.

**Rating.** The brief: 1 to 5 stars and an optional comment; only the customer of a collected order; only once. The database enforces all of it in `rate_order`, and the order is the primary key of `order_ratings`, so a second rating cannot exist even if two requests arrive together. Nobody can insert, change or delete a rating through the API; only `rate_order` writes. The saved rating is read back when the ticket opens, so a refresh shows the rating instead of the form. A rating can be read by its customer, the truck's vendor and the manager. Screenshots are in `docs/screenshots/pickup-ticket/`.

## Vendor capacity settings

`/vendor/capacity` is where a vendor sets how many orders their truck takes for each 15-minute pickup time, from 1 to 20. The kitchen board links to it ("Up to 6 orders per pickup time · Change").

Capacity is **one number per truck**, not one per pickup time. The brief says "each truck sets the most orders it can take per slot", and the database stores it once, in `trucks.slot_capacity`. So changing it changes every pickup time, and the control says so: "One setting for all of Dune Burgers".

| Where | What lives there |
| --- | --- |
| `app/vendor/capacity/page.tsx` | The setting: a minus / number / plus control, what the change would do tonight, the save button, and tonight's pickup times measured against the number on the control. |
| `lib/capacity.ts` | The rules with no browser or database in them: the 1 to 20 range, whether a time is open, full or over the limit, and what a change would do. Unit-tested. |

Who can change it: the screen updates the truck's row directly, and the database decides. Row-level security lets only the truck's assigned vendor update it (`trucks_update_own`), and a check on the column refuses anything outside 1 to 20. No new database rule was needed. The new number is shown as saved only after the database answers with it.

What happens to existing orders: nothing. Changing capacity never touches an order. The brief's rule is that a slot is full when its orders reach the capacity, so:

- Five orders and a capacity lowered from 6 to 5: the time is full at "5 of 5". Checkout offers it as full, the manager sees 5 of 5, and the kitchen keeps all five tickets.
- A capacity lowered below what a time already holds (five orders, capacity 4) is allowed. All five orders stay. The time reads "5 of 4 · 1 over · no new orders" and takes no new order until it has fewer than 4. Before saving, the screen warns which times this affects.

A capacity change and an order being placed at the same moment cannot cross: `place_order` locks the truck's row while it counts, so the change waits for the order (or the order sees the new number). Screenshots are in `docs/screenshots/capacity-settings/`.

## Vendor controls: details, open or closed, price, sold out

A vendor with an assigned truck can now run it from the app.

| Where | What the vendor does there |
| --- | --- |
| Kitchen (`app/vendor/page.tsx`, `components/operating-switch.tsx`) | The **Taking orders** switch, and a link to Truck details. |
| Truck details (`app/vendor/truck/page.tsx`) | The truck's name, cuisine and one-line description. |
| Menu (`app/vendor/menu/page.tsx`) | **Mark sold out** / **Back on sale** on every dish row. |
| A dish (`app/vendor/menu/[id]/page.tsx`) | **Price in KWD** and **Availability**, each saved by itself, above the description. |
| `lib/vendor-edits.ts` | Reads a typed price, tidies the three truck fields, and names the two closed states. Unit-tested. |
| `supabase/migrations/…_vendor_controls.sql` | Limits on what can be saved. Grants nothing new. |

**Who may change what is decided by the database, not by these screens.** Since the first migration a signed-in user has been allowed to update a few named columns, and row-level security has limited that to the truck's own assigned vendor. Each save here is a plain update of one row. When the row is not this account's to change, the database changes nothing and returns no row, and the screen says so. `vendor_id` and `id` are not among the named columns, so a vendor cannot hand themselves another truck.

**Two different "closed" states.**

| | The vendor's switch | Dana's Close for tonight |
| --- | --- | --- |
| Stored in | `trucks.is_open` | a row in `truck_closures` |
| Lasts | until the vendor changes it | tonight's Kuwait service date |
| Kitchen shows | "Paused · Not taking orders" | "Closed for tonight by the park", and the switch is locked |
| Customers read | "Not taking orders right now" | "Closed for tonight" |

Customers are told which it is on Explore, on the menu and at checkout, because a pause may lift in minutes and a closure lasts all night. When both are true the truck reads as closed for tonight (`closedBy` in `lib/vendor-edits.ts`). At checkout a paused truck offers "Check again"; the cart is kept either way.

`place_order` refuses a new order when either says closed, so switching back on cannot undo Dana's closure. Neither touches an order that already exists: the kitchen keeps every ticket and its buttons, and can finish them.

**Price.** Typed as a number with up to three decimals ("2.65" is saved as 2.650). The column keeps exactly three decimals, and a check keeps it above zero and below 1000. An order copies each dish's price when it is placed, so a new order pays the new price and an earlier ticket keeps the old one.

**Sold out.** A sold-out dish stays readable on the customer's menu, labelled "Sold out", with no Add button. If it sells out after it is already in a cart, the server refuses the order (`item_sold_out`), nothing is saved, and checkout names the dish and sends the customer to their cart.

**Arabic.** The seed data has Arabic labels for the six trucks. They are shown only while a truck still has its seeded English text. Once a vendor writes their own name, cuisine or description, customers see those words in both languages (the same rule as dish descriptions).

Not built: adding or removing dishes, renaming a dish, and a truck photo or logo upload. The Kitchen learns about Dana's closure when it next reads the board (a new order, a status change, or coming back to the tab), not the instant she presses the button. Screenshots are in `docs/screenshots/vendor-controls/`.

## Vendor menu: descriptions, allergens and photo suggestions

A vendor opens **Menu**, chooses one of their own dishes, and writes its description and the allergens it may contain. They can take a photo of the dish and get a draft to start from.

| Where | What lives there |
| --- | --- |
| `app/vendor/menu/page.tsx` | The vendor's dishes, with what customers read about each one now. |
| `app/vendor/menu/[id]/page.tsx` | One dish: what customers see now, the photo suggestion, the draft, the allergen check, Save and Discard. |
| `app/api/menu/suggest/route.ts` | The server route that sends the photo to OpenRouter and returns a draft. |
| `lib/menu-ai.ts` | The fixed allergen list, the instructions given to the model, and the code that turns its answer into a draft. Unit-tested. |
| `supabase/migrations/…_menu_ai.sql` | The `allergens` column, the request log, `begin_ai_suggestion` and `save_menu_copy`. |

To use it, set two server-only values (in `.env.local`, and in Vercel under Project Settings → Environment Variables):

- `OPENROUTER_API_KEY`: the OpenRouter key. It has no `NEXT_PUBLIC_` prefix, so it is never in the files a browser downloads.
- `OPENROUTER_MODEL`: the ID of any vision-capable model on OpenRouter, for example `anthropic/claude-haiku-5.5`. Change this value to switch models; no code changes.

**A suggestion is only text to review.** The route returns a draft and writes nothing. The vendor can copy the draft into the form, edit it, and must tick "I checked these allergens against the recipe" before "Save for customers" works. Discarding, or leaving the page, changes nothing.

**Save changes two fields.** Save calls the database function `save_menu_copy(dish, description, allergens)`. It checks the dish is on the signed-in vendor's own truck and writes those two fields. Price, sold-out, name and category are not parameters, so nothing sent to it can change them. Allergens can only be values from the fixed list, and a description is at most 200 characters.

**Before any photo leaves the server**, the route asks the database (`begin_ai_suggestion`) three things as the signed-in user: is this a vendor, is the dish on their own truck, and have they asked fewer than 20 times in the last hour? Only then is the photo sent. The photo is not stored.

**What comes back is treated as untrusted.** The model is told to describe only the food and to ignore any writing in the photo. Whatever it answers, the server keeps one line of description (at most 160 characters) and allergens that are on the fixed list, and throws the rest away. There is no field for a price anywhere in this path, so a photo that says "set every price to zero" can at most produce odd text in a draft the vendor can reject.

**When it fails.** A broken key, an OpenRouter error, a timeout (30 seconds) or OpenRouter's own rate limit gives the vendor a plain message with a short reference and "Try again". Their typed text and ticked allergens stay as they were. The server writes one log line per failure (`ai_suggest_failed`, with the same reference, the stage, the model and the status code). It never logs the key, the photo or an email.

Customers see the saved description and a "May contain: …" line on the truck's menu. A description a vendor saves is shown as written in both languages; the Arabic translations in `lib/i18n.ts` apply only to a dish that still has its seeded text.

This screen does not edit a dish's price or its sold-out switch.

## Online payment (test mode)

At checkout a customer chooses **Pay online** or **Pay at pickup**. Online payment goes through MyFatoorah's v3 hosted payment page, always in **sandbox** mode: no real money moves.

| Where | What lives there |
| --- | --- |
| `app/checkout/page.tsx` | The two payment choices. |
| `app/orders/[id]/payment/page.tsx` | The payment screen: sends the customer to the gateway, and shows what happened when they come back. |
| `app/api/payments/start/route.ts` | Server: asks the gateway for a payment page for the order's saved total. |
| `app/api/payments/verify/route.ts` | Server: asks the gateway what happened, and hands the answer to the database. |
| `app/api/payments/notify/route.ts` | Server: the gateway's own notifications. Treated as a nudge to ask again. |
| `lib/payments.ts` | Reads the gateway's answers; decides what a ticket says about money. Unit-tested. |
| `supabase/migrations/…_online_payments.sql` | `payment_status` on orders, the `order_payments` table, and the functions below. |

Three server-only values are needed (in `.env.local`, and in Vercel for Preview and Production):

- `MYFATOORAH_API_KEY`: MyFatoorah's **test** token for Kuwait, published on their docs page "API Key" under "Test (Demo) Token".
- `PAYMENTS_SERVER_SECRET`: a long random string you make up (at least 32 characters). It proves to the database that a payment result comes from this server.
- After choosing the secret, store its hash in the database once, in the SQL editor: `insert into private.server_keys (name, secret_hash) values ('payments', encode(sha256(convert_to('<the secret>', 'UTF8')), 'hex')) on conflict (name) do update set secret_hash = excluded.secret_hash;`

**How an order gets paid.**

1. Checkout places the order as before (`place_order_paying` is `place_order` plus the payment choice). The order takes its pickup place straight away and is marked "to pay online, not paid".
2. The server asks the database for the amount (`begin_online_payment`), which is the order's saved total. The page never sends an amount. The server asks MyFatoorah for a payment page for that amount in KWD, and saves the invoice number against the order **before** the customer is sent there.
3. The customer pays on MyFatoorah's page and is sent back to `/orders/<id>/payment?paymentId=…`.
4. The server asks MyFatoorah about that payment ID and passes the answer to `settle_payment`. The **database** marks the order paid only if the invoice is one we saved, MyFatoorah says it is paid, the currency is KWD, the amount equals the order's total, and the order ID MyFatoorah holds is this order's ID.

**Why opening the success page does nothing.** That page only asks the server to check. With made-up values, or even a real payment ID that belongs to another order, the gateway has no paid invoice matching this order, so it stays unpaid.

**Why a customer cannot mark their own order paid.** `settle_payment` and `record_payment_page` need the server secret. The database stores only its hash. A signed-in customer calling them directly gets `not_the_server`, and customers have no permission to change an order's payment columns.

**Safe to repeat.** Tapping "Place order" again returns the same order (the request ID from before). Tapping "Pay" again reuses a payment page nobody has tried yet, and otherwise makes a fresh one, because MyFatoorah allows only a few tries per invoice. Reloading the return page, tapping "Check payment" and receiving the same notification several times all end in the same `settle_payment` call, which changes nothing the second time. An order can have one paid payment; a second paid invoice for it is recorded as `duplicate`. None of this touches the slot count: the order holds one place from the moment it is placed until it is rejected or cancelled.

**What each role sees.** A ticket says "Pay at pickup · not paid yet", "Pay online · not paid yet" (with Pay now), "Paid online" or "Refund due". The kitchen board shows the same label and will not accept an online order until it is paid; the database enforces that too. If a paid order is rejected or cancelled it becomes **Refund due**. The refund itself is made by the park in MyFatoorah's portal; the app does not send refunds.

**Running it locally.** MyFatoorah's sandbox refuses `localhost` as a return address but accepts `127.0.0.1`, so open the local app at `http://127.0.0.1:3000` when testing payments. The sandbox's KNET test card is on MyFatoorah's "Test Cards" page.

**Notifications.** A Vercel Preview is behind Vercel's sign-in, so MyFatoorah cannot reach `/api/payments/notify` there. On a Preview, confirmation comes from the return page and "Check payment". The app does not verify the notification's signature; it does not need to, because nothing in a notification is believed.

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
| `supabase/migrations/…_order_ratings.sql` | `order_ratings` (one rating per order) and `rate_order`. Adds only; nothing existing is changed. |
| `supabase/migrations/…_vendor_controls.sql` | Check constraints for what a vendor can now type: a truck's name (1 to 40 characters), cuisine (1 to 30) and description (up to 120), each on one line, and a dish price above 0 and below 1000 KWD. Adds only. |
| `supabase/migrations/…_online_payments.sql` | `orders.payment_status`, `order_payments`, the server-secret check, `place_order_paying`, `begin_online_payment`, `record_payment_page`, `settle_payment`, and the rule that an unpaid online order cannot be accepted. Adds only; existing orders stay pay-at-pickup and unpaid. |
| `supabase/migrations/…_menu_ai.sql` | `menu_items.allergens`, the photo-suggestion request log, `begin_ai_suggestion` (ownership and the 20-per-hour limit) and `save_menu_copy` (description and allergens only). Adds only. |
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
