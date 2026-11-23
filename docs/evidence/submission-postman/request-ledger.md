# Saved Postman requests and retained passing results

Sanitized transcription of the three retained CLI logs, matched by request name to the saved YAML. Raw responses, tokens, gateway identifiers and checkout URLs are excluded. SHA-256 hashes of original logs and request files are in [reconciliation.json](reconciliation.json). This is a reconstruction from retained logs, not a new run.

## 1000 · checkout/login-customer

[Saved request](collection/checkout/login-customer.request.yaml) · POST `{{supabaseUrl}}/auth/v1/token?grant_type=password`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: customer session issued

## 2000 · checkout/login-vendor

[Saved request](collection/checkout/login-vendor.request.yaml) · POST `{{supabaseUrl}}/auth/v1/token?grant_type=password`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: vendor session issued

## 3000 · checkout/customer-role

[Saved request](collection/checkout/customer-role.request.yaml) · GET `{{supabaseUrl}}/rest/v1/profiles?select=role&id=eq.{{customerId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Customer role comes from database

## 4000 · checkout/vendor-truck

[Saved request](collection/checkout/vendor-truck.request.yaml) · GET `{{supabaseUrl}}/rest/v1/trucks?select=id,is_open,vendor_id&id=eq.{{truckId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Vendor owns the open test truck

## 5000 · checkout/menu-price

[Saved request](collection/checkout/menu-price.request.yaml) · GET `{{supabaseUrl}}/rest/v1/menu_items?select=id,truck_id,price_kwd,description,allergens,sold_out&id=eq.{{itemId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Dish is available and priced

## 6000 · checkout/available-slot

[Saved request](collection/checkout/available-slot.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/slot_usage`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Choose an available pickup at least 30 minutes ahead

## 7000 · checkout/place-pay-at-pickup

[Saved request](collection/checkout/place-pay-at-pickup.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/place_order_paying`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Order is saved with server price and correct owner

## 8000 · checkout/retry-checkout

[Saved request](collection/checkout/retry-checkout.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/place_order_paying`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Retry returns the same order

## 9000 · checkout/saved-line-items

[Saved request](collection/checkout/saved-line-items.request.yaml) · GET `{{supabaseUrl}}/rest/v1/order_items?select=item_id,quantity,unit_price_kwd&order_id=eq.{{pickupOrderId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: One correctly priced line persisted

## 10000 · checkout/cancel-pickup-test-order

[Saved request](collection/checkout/cancel-pickup-test-order.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/set_order_status`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Test order cancelled and capacity released

## 11000 · checkout/place-online-order

[Saved request](collection/checkout/place-online-order.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/place_order_paying`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Order is saved with server price and correct owner

## 12000 · checkout/unpaid-order-cannot-be-accepted

[Saved request](collection/checkout/unpaid-order-cannot-be-accepted.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/set_order_status`

Actual retained status: **400 Bad Request**

- Pass: Vendor cannot accept unpaid online order

## 13000 · checkout/create-payment-page

[Saved request](collection/checkout/create-payment-page.request.yaml) · POST `{{baseUrl}}/api/payments/start`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Sandbox payment page created

## 14000 · checkout/reuse-payment-page

[Saved request](collection/checkout/reuse-payment-page.request.yaml) · POST `{{baseUrl}}/api/payments/start`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Untouched payment page is reused

## 15000 · checkout/unpaid-before-gateway

[Saved request](collection/checkout/unpaid-before-gateway.request.yaml) · POST `{{baseUrl}}/api/payments/verify`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Creating an invoice does not mark an order paid

## 16000 · checkout/saved-invoice-amount

[Saved request](collection/checkout/saved-invoice-amount.request.yaml) · GET `{{supabaseUrl}}/rest/v1/order_payments?select=amount_kwd,currency,status&order_id=eq.{{onlineOrderId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Invoice uses saved amount despite client tampering

## 17000 · ai/login-customer

[Saved request](collection/ai/login-customer.request.yaml) · POST `{{supabaseUrl}}/auth/v1/token?grant_type=password`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: customer session issued

## 18000 · ai/login-vendor

[Saved request](collection/ai/login-vendor.request.yaml) · POST `{{supabaseUrl}}/auth/v1/token?grant_type=password`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: vendor session issued

## 19000 · ai/menu-before

[Saved request](collection/ai/menu-before.request.yaml) · GET `{{supabaseUrl}}/rest/v1/menu_items?select=id,truck_id,price_kwd,description,allergens,sold_out&id=eq.{{itemId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Remember saved menu copy and price

## 20000 · ai/customer-is-not-vendor

[Saved request](collection/ai/customer-is-not-vendor.request.yaml) · POST `{{baseUrl}}/api/menu/suggest`

Actual retained status: **401 Unauthorized**

- Pass: HTTP 401
- Pass: Customer cannot request vendor AI generation

## 21000 · ai/vendor-needs-photo

[Saved request](collection/ai/vendor-needs-photo.request.yaml) · POST `{{baseUrl}}/api/menu/suggest`

Actual retained status: **400 Bad Request**

- Pass: HTTP 400
- Pass: Malformed photo upload rejected

## 22000 · ai/generate-dish-suggestion

[Saved request](collection/ai/generate-dish-suggestion.request.yaml) · POST `{{baseUrl}}/api/menu/suggest`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Live model returns a bounded draft with allowed allergens

## 23000 · ai/menu-after

[Saved request](collection/ai/menu-after.request.yaml) · GET `{{supabaseUrl}}/rest/v1/menu_items?select=id,truck_id,price_kwd,description,allergens,sold_out&id=eq.{{itemId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Generating a draft leaves saved description, allergens and price unchanged

## 24000 · completion/login-customer

[Saved request](collection/completion/login-customer.request.yaml) · POST `{{supabaseUrl}}/auth/v1/token?grant_type=password`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: customer session issued

## 25000 · completion/verify-paid

[Saved request](collection/completion/verify-paid.request.yaml) · POST `{{baseUrl}}/api/payments/verify`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Gateway-confirmed payment is paid

## 26000 · completion/verify-paid-again

[Saved request](collection/completion/verify-paid-again.request.yaml) · POST `{{baseUrl}}/api/payments/verify`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Gateway-confirmed payment is paid

## 26500 · completion/payment-notification

[Saved request](collection/completion/payment-notification.request.yaml) · POST `{{baseUrl}}/api/payments/notify`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Gateway notification acknowledged

## 26600 · completion/duplicate-payment-notification

[Saved request](collection/completion/duplicate-payment-notification.request.yaml) · POST `{{baseUrl}}/api/payments/notify`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Gateway notification acknowledged

## 27000 · completion/paid-order

[Saved request](collection/completion/paid-order.request.yaml) · GET `{{supabaseUrl}}/rest/v1/orders?select=id,payment_status,total_kwd,paid_at&id=eq.{{onlineOrderId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Paid status and timestamp persisted

## 28000 · completion/one-paid-invoice

[Saved request](collection/completion/one-paid-invoice.request.yaml) · GET `{{supabaseUrl}}/rest/v1/order_payments?select=status,currency,amount_kwd&order_id=eq.{{onlineOrderId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Exactly one invoice is paid

## 29000 · completion/cancel-paid-test-order

[Saved request](collection/completion/cancel-paid-test-order.request.yaml) · POST `{{supabaseUrl}}/rest/v1/rpc/set_order_status`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Completed sandbox test order cancelled

## 30000 · completion/refund-due-after-cancel

[Saved request](collection/completion/refund-due-after-cancel.request.yaml) · GET `{{supabaseUrl}}/rest/v1/orders?select=status,payment_status&id=eq.{{onlineOrderId}}`

Actual retained status: **200 OK**

- Pass: HTTP 200
- Pass: Cancelling a paid order records refund due

