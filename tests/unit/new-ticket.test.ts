import test from "node:test";
import assert from "node:assert/strict";
import { markNewTicket, consumeNewTicket } from "../../lib/new-ticket.ts";

test("receipt entrance is scoped to the saved order and customer, and consumed once", () => {
  markNewTicket("a", "saved");
  assert.equal(consumeNewTicket("b", "saved"), false);
  assert.equal(consumeNewTicket("a", "other"), false);
  assert.equal(consumeNewTicket("a", "saved"), true);
  assert.equal(consumeNewTicket("a", "saved"), false);
});
