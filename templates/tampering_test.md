# Tampering Test · write-up

**Candidate:** ____________ **Live link:** ____________ **Date tested:** ____________

Do every attempt on your **live** link, not on your laptop. Send the requests yourself (browser DevTools, Postman or curl), not through your app's buttons: the buttons already hide what is not allowed.

A blocked update can come back as a success with no rows changed. For every attempt, check the data afterwards, not just the status code.

Copy this block for each attempt:

```
### Attempt N · <name>
- Account used: <customer / vendor / which truck>
- What I sent: <method, URL, body. Remove any token before you paste it here>
- What came back: <status code and body>
- The data afterwards: <proof that nothing changed: a query or a screenshot>
- The rule that stopped it: <policy, constraint, trigger, function or server route, and the file it lives in>
- Screenshot: <file name>
```

## Core: all six are required

### Attempt 1 · Change the price
Place an order with a lower price, your own total, or a negative quantity in the request.

### Attempt 2 · Skip the order rules
As a customer, move your own order to `accepted` or `collected`. As a vendor, move an order from `placed` straight to `ready`.

### Attempt 3 · Read what is not yours
As a vendor, read another truck's orders. As a customer, open someone else's order by changing its ID.

### Attempt 4 · Overbook
Book a full slot, or any slot on a closed truck, by sending the request yourself.

### Attempt 5 · Promote yourself
Make your own account the park manager, or turn a customer into a vendor, by editing your own profile.

### Attempt 6 · Find the keys
Search the client bundle and the network requests for the OpenRouter key and the Supabase service-role key. Say where each key really lives.

## Level 2 · Premium

### Attempt 7 · Fake the payment
Open your payment success page for an order you have not paid, with any query values you like.

## Level 3 · Elite

### Attempt 8 · Race for the last place
Leave one place in a slot. From two browsers, place an order at the same moment. Do it five times. Record the screen.

## What surprised me

Which attempt did not fail the first time, and what did you change?
