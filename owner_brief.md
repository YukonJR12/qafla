# Qafla Truck Park · The park manager's brief

**CODED · Teaching Assistant technical challenge · AI App Developer**

> "Our busy nights are our worst nights. The queues get long, food waits on the counter, and people give up and leave. I want customers to order ahead from their phone, pick a time, and collect their food hot. I also need to trust it: no one pays less than the menu price, no truck sees another truck's orders, and no pickup time gets more orders than a truck can cook."
>
> Dana, park manager

Qafla is a fictional food-truck park in Kuwait. Every truck, dish and person in this pack is made up.

## The park

| Rule | Value |
| --- | --- |
| Opening hours | Every day, 5:00 PM to 11:00 PM, Kuwait time (UTC+3) |
| Pickup slots | 15 minutes long. The first starts at 5:00 PM, the last at 10:45 PM: 24 slots a day |
| Booking window | Today only, and only for a slot that starts at least 15 minutes from now |
| Slot capacity | Each truck sets the most orders it can take per slot, from 1 to 20. Start from `default_slot_capacity` in `seed/trucks.csv` |
| Money | Kuwaiti dinars (KWD), always with 3 decimals |

## Who uses the app

| Role | What they can do |
| --- | --- |
| **Customer** | Browse open trucks, order from one truck, pick a slot, follow the order live, cancel it while it is still `placed`, rate it once it is `collected` |
| **Vendor** | Run one truck: its details, its menu, open or closed, its slot capacity. See and move that truck's orders, and nobody else's |
| **Park manager** | See every truck and every order. Close any truck for the night. This role is given in the database only: nobody can choose it at signup or give it to themselves |

Customers and vendors choose their role at signup. One role per account.

## Orders

- An order is from **one truck** and holds **1 to 10 of each item**. Sold-out items and closed trucks take no orders.
- The **total** is the sum of quantity × price for each item, using the menu price **at the moment the order is placed**. If a vendor changes a price later, orders already placed keep their old price.
- A slot is **full** when its orders reach the truck's capacity. Every order counts except `rejected` and `cancelled` ones.
- Order statuses, and who moves them:

| From | To | Who |
| --- | --- | --- |
| `placed` | `accepted` | the truck's vendor |
| `accepted` | `preparing` | the truck's vendor |
| `preparing` | `ready` | the truck's vendor |
| `ready` | `collected` | the truck's vendor |
| `placed` | `rejected` (with a reason) | the truck's vendor |
| `placed` | `cancelled` | the customer who placed it |

No other moves are allowed. No skipping, no going back.

- **Ratings:** 1 to 5 stars and an optional comment. Only the customer of a `collected` order can rate it, and only once.

## Dish descriptions

22 of the 30 dishes in `seed/menu_items.csv` have no description. Vendors upload a photo of a dish and the app suggests a short description and the allergens it may contain. The vendor edits the suggestion before saving it. **A suggestion is only text for the vendor to review.** It never changes a price, a sold-out switch or anything else.

## Payment (Level 2 only)

Customers pay online or at pickup. An online order counts as `paid` only after the app's server has confirmed the payment with the gateway. If a vendor rejects a paid order, the order shows **Refund due**. Test mode only: no real money, ever.

## What Dana cares about most

1. Nobody gets food for less than the menu price.
2. No truck sees another truck's orders.
3. No slot takes more orders than the truck can cook.
4. The app is live on a link she can open on her phone.
