# Sandbox payment walkthrough: local production build

- **Where:** local production build (`pnpm start`, opened at `http://127.0.0.1:3001`) of `feat/test-mode-payments`, dev Supabase project, MyFatoorah **sandbox** (`apitest.myfatoorah.com`), 2026-11-20, about 7:45 PM to 8:10 PM Kuwait time.
- **Accounts:** the test customer and the test Dune Burgers vendor.
- **Order used:** 1 Classic smash + 1 Loaded fries = 3.200 KWD, Dune Burgers.
- **Card:** MyFatoorah's published KNET test card. No real money.

## Orders, payment states and slot counts

| Ticket | Pickup | What was done | Order status | Payment status |
| --- | --- | --- | --- | --- |
| `T02-000045` | 8:15 PM | Pay online. Cancelled at the bank page, then a declined card, then paid. Return page reloaded twice. | placed | **paid** |
| `T02-000047` | 8:30 PM | Pay online. Attempt 7 first, then a declined card, a cancel, then paid. Then the vendor rejected it ("Out of buns tonight"). | rejected | **refund_due** |
| `T02-000048` | 8:30 PM | Pay at pickup. | placed | unpaid |
| `T02-000046` | 8:30 PM | A stray test order caused by a bug found during this run (see the last section); cancelled through the app. | cancelled | unpaid |

Slot counts as the steps happened (Dune Burgers takes 6 per pickup time):

- **8:15 PM:** 1 of 6 once `T02-000045` was placed. Still 1 of 6 after the cancel, the declined card, the payment and two reloads of the return page.
- **8:30 PM:** 1 of 6 once `T02-000047` was placed. Still 1 through Attempt 7, the declined card, the cancel, the payment and five notifications. It went to 0 when the vendor rejected the order, and back to 1 when `T02-000048` was placed.
- **Orders in the database:** 44 before, 48 after (the four above). No retry, reload or notification added an order or a place.

## Attempt 7: open the success page for an order that was not paid

Order `T02-000047`, placed with Pay online and not yet paid. Each address was opened while signed in as its customer.

| Address opened | Screen | Database |
| --- | --- | --- |
| `/orders/<id>/payment` | "We haven't had confirmation yet … is not marked paid." | unpaid |
| `…/payment?paymentId=100201923790872553&Id=…` (made up) | same | unpaid |
| `…/payment?paymentId=PAID&status=success&paid=true&amount=3.200&InvoiceStatus=Paid` | same | unpaid |
| `…/payment?paymentId=<the real payment ID of T02-000045, which was paid>` | same | unpaid |

`T02-000045` stayed paid, and no payment row for `T02-000047` was marked paid.

## Repeated notifications

Five requests to `/api/payments/notify` after `T02-000047` was paid: the real payment ID three times, a made-up payment ID claiming "PAID", and one with no ID at all. Each got `200 {"received":true}`. Both orders and every payment row were identical before and after.

## Server log lines (stdout of the local server)

No token, secret, email or card number is logged.

```json
{"event":"payment_page_created","requestId":"6ecf4ffd","ticket":"T02-000047","invoice":"7395362","amount":"3.200"}
{"event":"payment_settled","requestId":"2687fa2b","ticket":"T02-000047","invoice":"7395362","payment":"failed","payment_status":"unpaid","gateway":"PENDING/FAILED","amount":3.2,"currency":"KWD"}
{"event":"payment_page_created","requestId":"b796d470","ticket":"T02-000047","invoice":"7395364","amount":"3.200"}
{"event":"payment_settled","requestId":"cd5cf0a4","ticket":"T02-000047","invoice":"7395364","payment":"failed","payment_status":"unpaid","gateway":"PENDING/FAILED","amount":3.2,"currency":"KWD"}
{"event":"payment_page_created","requestId":"752926ea","ticket":"T02-000047","invoice":"7395365","amount":"3.200"}
{"event":"payment_settled","requestId":"5e4b46a0","ticket":"T02-000047","invoice":"7395365","payment":"paid","payment_status":"paid","gateway":"PAID/SUCCESS","amount":3.2,"currency":"KWD"}
```

## What the sandbox taught us

- Cancelling on the bank's page comes back as a **failed** transaction, so the screen says "The payment failed" for both a declined card and a cancel.
- MyFatoorah allows only a few tries on one invoice ("The maximum number of payment attempts has been reached!"). "Pay now" therefore makes a fresh invoice once the last one has been tried. A failed try also does not close an invoice: a later try on it can still succeed, and is then accepted.
- The sandbox refuses `localhost` as a return address and accepts `127.0.0.1`.
- A v3 payment can only be looked up by payment ID, which arrives on the return address. For "Check payment" without one, the server first asks MyFatoorah which payments exist for the saved invoice.
- **A bug the real clock exposed.** The first version switched a new order to "online" only when its two timestamps were identical. The test database pins the clock, so the tests passed; in the real database the timestamps differ by microseconds, and `T02-000046` was saved as pay-at-pickup although "Pay online" was chosen. The condition was removed.
