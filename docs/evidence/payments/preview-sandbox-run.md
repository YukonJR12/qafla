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

## Not shown on the Preview: a failed or cancelled payment

Two tries were made to show a cancel at the bank page on the Preview. Neither left a failed payment behind:

- `T02-000051` (3.200 KWD, 9:45 PM) was meant to be cancelled at the bank page. MyFatoorah reports it **paid**, and the database agrees.
- `T02-000052` (1 Classic smash + 1 Spicy chicken burger, **4.050 KWD**, 9:45 PM) was then placed with Pay online. MyFatoorah holds its invoice `7395449` as pending with no payment tries at all, and the app shows "We haven't had confirmation yet". It is unpaid.

So the failed and cancelled cases are evidenced on the local production build only (`local-sandbox-run.md`). One thing `T02-000052` does show: the amount sent to the gateway followed the cart (4.050), not a fixed figure.

## State left in the dev project by this run

| Ticket | Pickup | Method | Order status | Payment status |
| --- | --- | --- | --- | --- |
| `T02-000049` | 9:15 PM | online | rejected | refund_due |
| `T02-000050` | 9:15 PM | pay at pickup | placed | unpaid |
| `T02-000051` | 9:45 PM | online | placed | paid |
| `T02-000052` | 9:45 PM | online | placed | unpaid |

Slot counts at the end: 9:15 PM 1 of 6, 9:45 PM 2 of 6. Orders: 48 before this run, 52 after.
