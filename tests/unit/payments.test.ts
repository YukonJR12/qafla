// Unit tests for reading the payment gateway's answers and for what a
// ticket says about money. Run with: pnpm test:unit
// The examples follow MyFatoorah's v3 documentation.

import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccept, canPayNow, cleanPaymentId, gatewayAmount, isPaymentMethod, paymentView, readCreatedPage, readGatewayPayment } from "../../lib/payments.ts";

test("the amount sent to the gateway is the order total with at most three decimals", () => {
  assert.equal(gatewayAmount("3.200"), 3.2);
  assert.equal(gatewayAmount(3.2), 3.2);
  assert.equal(gatewayAmount("0.750"), 0.75);
  assert.equal(gatewayAmount(1.95 + 1.25), 3.2, "no floating-point tail");
});

test("only the two payment methods exist", () => {
  assert.equal(isPaymentMethod("online"), true);
  assert.equal(isPaymentMethod("pay_at_pickup"), true);
  for (const other of ["free", "paid", "", null, undefined]) assert.equal(isPaymentMethod(other), false);
});

test("a created payment page needs an invoice ID and an https address", () => {
  const ok = { IsSuccess: true, Message: "", ValidationErrors: null, Data: { InvoiceId: "6148108", PaymentId: null, PaymentURL: "https://demo.MyFatoorah.com/KWT/ie/0507", PaymentCompleted: false } };
  assert.deepEqual(readCreatedPage(ok), { invoiceId: "6148108", paymentUrl: "https://demo.MyFatoorah.com/KWT/ie/0507" });
  assert.deepEqual(readCreatedPage({ IsSuccess: "true", Data: { InvoiceId: 6148108, PaymentURL: "https://x.example/p" } }), { invoiceId: "6148108", paymentUrl: "https://x.example/p" });
  for (const bad of [
    null,
    {},
    { IsSuccess: false, Data: ok.Data },
    { IsSuccess: true, Data: { InvoiceId: "1" } },
    { IsSuccess: true, Data: { InvoiceId: "1", PaymentURL: "javascript:alert(1)" } },
    { IsSuccess: true, Data: { InvoiceId: "1", PaymentURL: "http://not-secure.example" } },
    { IsSuccess: true, Data: { PaymentURL: "https://x.example/p" } },
  ]) {
    assert.equal(readCreatedPage(bad), null, JSON.stringify(bad));
  }
});

test("the gateway's payment answer is read into plain facts, without judging them", () => {
  const paid = {
    IsSuccess: true,
    Data: {
      Invoice: { Id: "6148108", Status: "PAID", ExternalIdentifier: "8db31df6-fc06-477a-a615-cc257e1b97cd" },
      Transaction: { Status: "SUCCESS", PaymentId: "07076148108296378072" },
      Amount: { ValueInBaseCurrency: 3.2, BaseCurrency: "KWD" },
    },
  };
  assert.deepEqual(readGatewayPayment(paid), {
    invoiceId: "6148108",
    paymentId: "07076148108296378072",
    invoiceStatus: "PAID",
    transactionStatus: "SUCCESS",
    amount: 3.2,
    currency: "KWD",
    externalIdentifier: "8db31df6-fc06-477a-a615-cc257e1b97cd",
  });
  // Missing parts come back as null, so the database refuses them.
  assert.deepEqual(readGatewayPayment({ IsSuccess: true, Data: { Invoice: { Id: 9 } } }), {
    invoiceId: "9",
    paymentId: null,
    invoiceStatus: null,
    transactionStatus: null,
    amount: null,
    currency: null,
    externalIdentifier: null,
  });
  for (const bad of [null, {}, { IsSuccess: false, Data: paid.Data }, { IsSuccess: true, Data: {} }, { IsSuccess: true, Data: { Invoice: {} } }]) {
    assert.equal(readGatewayPayment(bad), null, JSON.stringify(bad));
  }
});

test("a payment ID from the address is plain letters and digits, or it is not used", () => {
  assert.equal(cleanPaymentId("07076148108296378072"), "07076148108296378072");
  for (const bad of ["", "1", "../../v3/refunds", "abc def", "x".repeat(65), "id?keyType=1", null, 12345, undefined]) {
    assert.equal(cleanPaymentId(bad), null, String(bad));
  }
});

test("what a ticket says about money", () => {
  assert.equal(paymentView({ payment_method: "pay_at_pickup", payment_status: "unpaid" }), "pickup");
  assert.equal(paymentView({ payment_method: "online", payment_status: "unpaid" }), "awaiting");
  assert.equal(paymentView({ payment_method: "online", payment_status: "paid" }), "paid");
  assert.equal(paymentView({ payment_method: "online", payment_status: "refund_due" }), "refund_due");
  assert.equal(paymentView({ payment_method: "pay_at_pickup" }), "pickup", "an order read before this change");
});

test("the kitchen accepts pay-at-pickup and paid orders, not an unpaid online one", () => {
  assert.equal(canAccept({ payment_method: "pay_at_pickup", payment_status: "unpaid" }), true);
  assert.equal(canAccept({ payment_method: "online", payment_status: "paid" }), true);
  assert.equal(canAccept({ payment_method: "online", payment_status: "unpaid" }), false);
});

test("Pay now is offered only for an unpaid online order that is still alive", () => {
  assert.equal(canPayNow({ payment_method: "online", payment_status: "unpaid", status: "placed" }), true);
  assert.equal(canPayNow({ payment_method: "online", payment_status: "unpaid", status: "cancelled" }), false);
  assert.equal(canPayNow({ payment_method: "online", payment_status: "unpaid", status: "rejected" }), false);
  assert.equal(canPayNow({ payment_method: "online", payment_status: "paid", status: "placed" }), false);
  assert.equal(canPayNow({ payment_method: "online", payment_status: "refund_due", status: "rejected" }), false);
  assert.equal(canPayNow({ payment_method: "pay_at_pickup", payment_status: "unpaid", status: "placed" }), false);
});
