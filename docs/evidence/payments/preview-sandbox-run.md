# Sandbox payment walkthrough: Vercel Preview (`qafla-rjqd`)

- **Where:** Vercel Preview of `feat/test-mode-payments`, dev Supabase project, MyFatoorah **sandbox**, 2026-11-20, about 8:44 PM to 9:00 PM Kuwait time.
  - Steps 1 to 6: commit `f4948c8`, `dpl_FQtbK9STF1aAxpvhf9buiMV7Gqpz`, https://qafla-rjqd-4yh6ic5xy-ffalrefae-6713s-projects.vercel.app
  - Steps 7 and 8: commit `6256528`, `dpl_8bXLEzUsWE8uGY5GtucaqwpgaueK`, https://qafla-rjqd-keren0vql-ffalrefae-6713s-projects.vercel.app
- **How:** a signed-in Chrome tab at desktop width. The account owner typed every password and entered the KNET test card on the bank's page. Everything else was driven and checked by the assistant, with the database read after each step.
- **Order used:** 1 Classic smash + 1 Loaded fries = 3.200 KWD, Dune Burgers.

## Steps and results

| # | Step | Result |
| --- | --- | --- |
| 1 | Customer places the order with **Pay online**, 9:15 PM | `T02-000049` saved as online, unpaid, 3.200. Invoice `7395433` saved before the redirect. MyFatoorah's page showed 3.200 KD and our order ID as the reference. 9:15 PM: 0 → 1. Orders 48 → 49. |
| 2 | **Attempt 7:** open the success page for the unpaid order with a made-up payment ID plus `status=success&paid=true&amount=3.200` | "We haven't had confirmation yet … not marked paid." Database: unpaid. |
| 3 | **Attempt 7:** the same page with the **real** payment ID of `T02-000045`, an order that was paid earlier | Same screen. Database: unpaid. `T02-000045` still paid. |
| 4 | Reopen the payment page | The same invoice `7395433` was reused (nobody had tried it yet). |
| 5 | Customer pays with the KNET test card | Back on "Payment confirmed". `T02-000049`: **paid** at 8:51:33 PM. One payment row, PAID / SUCCESS, 3.2 KWD. Reopening the return page with and without the payment ID still said "Payment confirmed"; still one row and one order. 9:15 PM still 1. |
| 6 | Customer places a second order with **Pay at pickup**, 9:15 PM | `T02-000050` went straight to its ticket: "Pay at pickup · not paid yet". No payment row. 9:15 PM: 1 → 2. Orders 50. |
| 7 | Vendor signs in; the board shows `T02-000049` "Paid online" and `T02-000050` "Pay at pickup · not paid yet". Vendor **rejects** the paid order ("Out of buns tonight") | `T02-000049`: rejected, **refund_due**. 9:15 PM: 2 → 1. `T02-000050` untouched. |
| 8 | Customer opens `T02-000049`'s ticket | "Dune Burgers couldn't take this order", the reason, "You paid online, so the park will refund you", and **Refund due** under the 3.200 KWD total. |

## Vercel runtime log lines (Logs tab, environment=preview)

```json
{"event":"payment_page_created","requestId":"721d55a0","ticket":"T02-000049","invoice":"7395433","amount":"3.200"}
{"event":"payment_settled","requestId":"4e43f119","ticket":"T02-000049","invoice":"7395433","payment":"paid","payment_status":"paid","gateway":"PAID/SUCCESS","amount":3.2,"currency":"KWD"}
{"event":"payment_page_created","requestId":"d95c1dbf","ticket":"T02-000051","invoice":"7395447","amount":"3.200"}
{"event":"payment_settled","requestId":"3c1dff7a","ticket":"T02-000051","invoice":"7395447","payment":"paid","payment_status":"paid","gateway":"PAID/SUCCESS","amount":3.2,"currency":"KWD"}
{"event":"payment_page_created","requestId":"5af2fd42","ticket":"T02-000052","invoice":"7395449","amount":"4.050"}
```

## A failed payment on the Preview: `T02-000054` (21 November)

- **Where:** commit `fd9e77b`, `dpl_GfnFeQ5eNb3pQBkwUUyDhP7wi8za`, https://qafla-rjqd-4e0ofvj5i-ffalrefae-6713s-projects.vercel.app, dev Supabase project, MyFatoorah **sandbox**, 2026-11-21, 2:38 AM (order placed) and 12:45 PM to 12:52 PM Kuwait time.
- **How:** a signed-in Chrome tab. The account owner typed every password and pressed **Cancel** on KNET's card page. Everything else was driven and checked by the assistant.
- **What kind of failure:** a cancel at the bank page, not a declined card. No card number was entered. MyFatoorah reports both as a failed transaction and Qafla shows the same message for both; the declined-card case is evidenced on the local build only (`local-sandbox-run.md`).

| # | Step | Result |
| --- | --- | --- |
| 1 | Customer places 1 Classic smash + 1 Loaded fries with **Pay online**, 5:00 PM | `T02-000054` saved as online, unpaid, 3.200. Invoice `7395785` saved before the redirect. 5:00 PM: 0 → 1. Orders 53 → 54. |
| 2 | Back to the ticket in Qafla before any payment try | Ticket shows `T02-000054`, Placed, "Pay online · not paid yet". |
| 3 | "Pay now" straight away | The same invoice `7395785` was reopened (nobody had tried it). |
| 4 | The customer backed out of the bank page without submitting | "We haven't had confirmation yet … not marked paid." MyFatoorah: invoice `7395785` Pending, **no transactions**. Database: unpaid. |
| 5 | "Pay now" ten hours later | The first page was older than 20 minutes, so a new invoice `7396614` was made for the same order and amount (3.200 KD, our order ID as the reference). |
| 6 | KNET chosen; the customer pressed **Cancel** on KNET's card page | Back on Qafla: "**The payment failed.** Order T02-000054 is not paid. Your pickup place is still held. Pay again, or cancel the order from its ticket. Reference ba228bb3". |
| 7 | Ask MyFatoorah about invoice `7396614` | Invoice Pending. One KNET transaction: **Failed**, "Transaction canceled!", error code `MF006`, 3.200 KD, payment ID `100632510000001627`. |
| 8 | Database | `T02-000054`: placed, online, **unpaid**, no paid time. Payment rows: `7395785` created, `7396614` failed with that payment ID. |
| 9 | Reload the return page, open the ticket, open Orders | "The payment failed" again; ticket still "Pay online · not paid yet". Orders still 54, 5:00 PM still 1 of 6, still two payment rows. |
| 10 | Vendor's kitchen board | Ticket reads "Pay online · not paid yet" and "Wait for the payment before accepting." **Accept order is disabled.** |
| 11 | As the vendor, send the accept request directly (not through the button) | `400 payment_not_confirmed`: "This order is to be paid online and has not been paid yet." Placed → ready: `400 transition_not_allowed`. Database: still placed, unpaid, unchanged since it was placed. |
| 12 | Customer cancels the order from its ticket | "You cancelled this order. Your 5:00 PM place went back to the truck. There is nothing to pay." `T02-000054`: cancelled, unpaid. 5:00 PM: **1 → 0**. Orders still 54. |

After step 12 nothing else had moved: `T02-000050` placed / unpaid, `T02-000051` placed / paid, `T02-000052` placed / unpaid and `T01-000053` placed / unpaid (Karak Corner, 7:15 PM, still 1 of its slot) were all as before.

Vercel runtime log lines for this order (environment=preview):

```json
{"event":"payment_page_created","requestId":"3f112896","ticket":"T02-000054","invoice":"7396614","amount":"3.200"}
{"event":"payment_settled","requestId":"ba228bb3","ticket":"T02-000054","invoice":"7396614","payment":"failed","payment_status":"unpaid","gateway":"PENDING/FAILED","amount":3.2,"currency":"KWD"}
```

The reference on the customer's screen (`ba228bb3`) is the request ID in the second line. The log lines for the first invoice (2:38 AM) had passed Vercel's one-hour log window by the time they were looked for.

Screenshots: `preview-10-failed-ticket-before-payment.jpg`, `preview-11-failed-gateway-invoice.jpg`, `preview-12-failed-payment-failed.jpg`, `preview-13-failed-ticket-still-unpaid.jpg`, `preview-14-failed-vendor-cannot-accept.jpg`, `preview-15-failed-order-cancelled.jpg`.

### Earlier tries on 20 November that did not produce a failed payment

- `T02-000051` (3.200 KWD, 9:45 PM) was meant to be cancelled at the bank page. MyFatoorah reports it **paid**, and the database agrees.
- `T02-000052` (1 Classic smash + 1 Spicy chicken burger, **4.050 KWD**, 9:45 PM) was then placed with Pay online. MyFatoorah holds its invoice `7395449` as pending with no payment tries, and it is unpaid. It does show that the amount sent to the gateway followed the cart.

## The kitchen's "Refund due" label: not seen on the current build

`6256528` added "Refund due" and "Paid online" to the kitchen's "Finished tonight" list. On 21 November that list was empty on the Preview: `T02-000049`, the rejected paid order, belongs to 20 November and no longer appears. The label has not been seen rendered on the Preview or on the local build. What exists:

- the unit test that a paid order which was rejected reads as `refund_due` (`tests/unit/payments.test.ts`), which is the value the list prints;
- the customer's Refund due ticket on the Preview (`preview-09-customer-ticket-refund-due.jpg`);
- the kitchen board straight after the reject on the Preview (`preview-08-vendor-after-reject.jpg`), taken before the label was added.

## State left in the dev project by these runs

| Ticket | Pickup | Method | Order status | Payment status |
| --- | --- | --- | --- | --- |
| `T02-000049` | 9:15 PM | online | rejected | refund_due |
| `T02-000050` | 9:15 PM | pay at pickup | placed | unpaid |
| `T02-000051` | 9:45 PM | online | placed | paid |
| `T02-000052` | 9:45 PM | online | placed | unpaid |
| `T02-000054` | 5:00 PM, 21 Nov | online | cancelled | unpaid |

Slot counts at the end of 20 November: 9:15 PM 1 of 6, 9:45 PM 2 of 6. On 21 November every Dune Burgers slot is back to 0 of 6. Orders: 48 before the first run, 54 after the second (one of them, `T01-000053`, was not placed by these runs).
