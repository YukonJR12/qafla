// A checkout attempt whose result this browser has not seen yet.
//
// Just before "Place order" is sent, the attempt is written here: who sent
// it, its request ID, and exactly what was ordered. It is removed only when
// the server has settled it: a ticket, a refusal of that very request, or
// the customer abandoning it (which the server records). If the answer
// never arrives, it stays, and checkout deals with it before anything else.
//
// "No order found" does NOT settle it. The request may still be on its
// way, so the attempt is kept until one of the three things above happens.
//
// Each customer has their own storage key, and the record also names its
// customer. Someone else signing in on the same browser never sees it.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingOrder = {
  customerId: string;
  requestId: string;
  truckId: string;
  truckName: string;
  slot: string;
  /** item id -> quantity, as sent */
  items: Record<string, number>;
};

/** The part of localStorage this file uses, so tests can pass a fake one. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyFor = (customerId: string) => `qafla.pending-order.v1.${customerId}`;

function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode or blocked storage
  }
}

/** The signed-in customer's unconfirmed attempt, or null. */
export function readPending(customerId: string, store: KeyValueStore | null = browserStore()): PendingOrder | null {
  try {
    const raw = store?.getItem(keyFor(customerId));
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingOrder;
    // The record must say it belongs to this customer, not just sit under their key.
    return pending && pending.customerId === customerId && typeof pending.requestId === "string" ? pending : null;
  } catch {
    return null;
  }
}

export function savePending(pending: PendingOrder, store: KeyValueStore | null = browserStore()) {
  try {
    store?.setItem(keyFor(pending.customerId), JSON.stringify(pending));
  } catch {
    // nothing to do; the attempt just won't be remembered across a refresh
  }
}

export function clearPending(customerId: string, store: KeyValueStore | null = browserStore()) {
  try {
    store?.removeItem(keyFor(customerId));
  } catch {
    // nothing to do
  }
}

/**
 * Asks the server whether this attempt has been saved. Only reads; it can
 * never place an order. Resolves to the order's ID, or null when no order
 * exists for it YET (the request may still arrive). Throws when the server
 * could not be reached.
 */
export async function findOrderForAttempt(db: SupabaseClient, pending: PendingOrder): Promise<string | null> {
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("customer_id", pending.customerId)
    .eq("client_request_id", pending.requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/**
 * The customer gives up on this attempt, and the server decides the race
 * with the original request. Resolves to the order's ID if the order was
 * saved after all, or null once the server has recorded the attempt as
 * abandoned: from then on a late copy of the request is refused, so the
 * cart can safely be unlocked. Throws when no clear answer came back.
 */
export async function abandonAttempt(db: SupabaseClient, pending: PendingOrder): Promise<string | null> {
  const { data, error } = await db.rpc("abandon_order_attempt", { p_request_id: pending.requestId });
  if (error) throw new Error(error.message);
  return (data as { id?: string | null } | null)?.id ?? null;
}

/** The server's own refusals. After one of these, nothing was saved. */
const REFUSALS = new Set([
  "slot_full",
  "slot_too_soon",
  "invalid_slot",
  "truck_closed",
  "truck_not_found",
  "item_sold_out",
  "item_not_on_menu",
  "invalid_cart",
  "invalid_quantity",
  "duplicate_item",
  "not_a_customer",
  "request_id_required",
  "request_id_reused",
  "request_abandoned",
]);

/**
 * Sorts the answer to "Place order" into three cases. Anything that is not
 * a ticket or one of the server's own refusals (a dropped connection, a
 * timeout, an unexpected error) is "unknown": the order may have been saved.
 */
export function outcomeOf(result: { data: unknown; error: { message?: string } | null }): "saved" | "refused" | "unknown" {
  if (!result.error && result.data) return "saved";
  return REFUSALS.has(result.error?.message ?? "") ? "refused" : "unknown";
}
