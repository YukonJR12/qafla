import type { SupabaseClient } from "@supabase/supabase-js";
import type { KitchenOrder, OrderStatus } from "./kitchen";
import { kuwaitNow, LEAD_SECONDS, slotSeconds } from "./time";

export type Truck = {
  id: string;
  name: string;
  cuisine: string;
  blurb: string;
  slot_capacity: number;
  is_open: boolean;
};

export type MenuItem = {
  id: string;
  truck_id: string;
  name: string;
  category: string;
  price_kwd: number;
  description: string | null;
  sold_out: boolean;
  /** Codes from the fixed allergen list (lib/menu-ai.ts). Empty when none are listed. */
  allergens: string[];
};

/** One 15-minute pickup slot as the database counts it right now. */
export type Slot = { slot_start: string; booked: number; capacity: number };

export type TruckTonight = Truck & {
  /** Closed by the vendor's switch or by the park manager for tonight. */
  closed: boolean;
  /** Earliest slot that can still be booked, or null when none is left. */
  nextSlot: string | null;
};

/** Slots that are far enough ahead (15 minutes) to book, full or not. */
export function upcomingSlots(slots: Slot[], now = kuwaitNow()): Slot[] {
  return slots.filter((s) => slotSeconds(s.slot_start) >= now.seconds + LEAD_SECONDS);
}

export function isFull(slot: Slot): boolean {
  return slot.booked >= slot.capacity;
}

/** The earliest bookable slot at or after `after` (a "19:15:00" string). */
export function nextBookable(slots: Slot[], after?: string): Slot | null {
  const from = after ? slotSeconds(after) : 0;
  return upcomingSlots(slots).find((s) => !isFull(s) && slotSeconds(s.slot_start) >= from) ?? null;
}

export async function fetchSlots(db: SupabaseClient, truckId: string): Promise<Slot[]> {
  const { data, error } = await db.rpc("slot_usage", { p_truck_id: truckId });
  if (error) throw new Error(error.message);
  return data as Slot[];
}

/** Is this truck closed tonight? Checks the vendor switch and tonight's closure. */
export async function fetchClosed(db: SupabaseClient, truckId: string): Promise<boolean> {
  const [truck, closure] = await Promise.all([
    db.from("trucks").select("is_open").eq("id", truckId).single(),
    db.from("truck_closures").select("truck_id").eq("truck_id", truckId).eq("service_date", kuwaitNow().date),
  ]);
  if (truck.error) throw new Error(truck.error.message);
  if (closure.error) throw new Error(closure.error.message);
  return !truck.data.is_open || closure.data.length > 0;
}

export async function fetchTruck(db: SupabaseClient, truckId: string): Promise<Truck | null> {
  const { data, error } = await db
    .from("trucks")
    .select("id,name,cuisine,blurb,slot_capacity,is_open")
    .eq("id", truckId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMenu(db: SupabaseClient, truckId: string): Promise<MenuItem[]> {
  const { data, error } = await db
    .from("menu_items")
    .select("id,truck_id,name,category,price_kwd,description,sold_out,allergens")
    .eq("truck_id", truckId)
    .order("id");
  if (error) throw new Error(error.message);
  return data;
}

/** Every truck with tonight's closure state and its next bookable time. */
export async function fetchTrucksTonight(db: SupabaseClient): Promise<TruckTonight[]> {
  const today = kuwaitNow().date;
  const [trucks, closures] = await Promise.all([
    db.from("trucks").select("id,name,cuisine,blurb,slot_capacity,is_open").order("id"),
    db.from("truck_closures").select("truck_id").eq("service_date", today),
  ]);
  if (trucks.error) throw new Error(trucks.error.message);
  if (closures.error) throw new Error(closures.error.message);
  const closedIds = new Set(closures.data.map((c) => c.truck_id));

  return Promise.all(
    trucks.data.map(async (truck) => {
      const closed = !truck.is_open || closedIds.has(truck.id);
      const slots = closed ? [] : await fetchSlots(db, truck.id);
      return { ...truck, closed, nextSlot: nextBookable(slots)?.slot_start ?? null };
    }),
  );
}

export type OrderLine = { item_id: string; item_name: string; quantity: number; unit_price_kwd: number };

export type Order = {
  id: string;
  ticket_ref: string;
  truck_id: string;
  service_date: string;
  slot_start: string;
  status: string;
  payment_method: string;
  /** 'unpaid', 'paid' (confirmed by the server with the gateway) or 'refund_due'. */
  payment_status: string;
  total_kwd: number;
  rejection_reason: string | null;
  trucks: { id: string; name: string } | null;
  order_items: OrderLine[];
};

/** Reads one saved order. Row-level security only returns it to its owner. */
export async function fetchOrder(db: SupabaseClient, orderId: string): Promise<Order | null> {
  const { data, error } = await db
    .from("orders")
    .select(
      "id,ticket_ref,truck_id,service_date,slot_start,status,payment_method,payment_status,total_kwd,rejection_reason,trucks(id,name),order_items(item_id,item_name,quantity,unit_price_kwd)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Order | null;
}

// ---------------------------------------------------------------------------
// The vendor's kitchen board
// ---------------------------------------------------------------------------

/** The truck this vendor account runs, or null when it runs none. */
export async function fetchMyTruck(db: SupabaseClient, vendorId: string): Promise<Truck | null> {
  const { data, error } = await db
    .from("trucks")
    .select("id,name,cuisine,blurb,slot_capacity,is_open")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Every order for one truck on tonight's Kuwait service date, with its
 * lines. Row-level security returns rows only to that truck's vendor (and
 * the manager), so asking for another truck's ID gives back nothing.
 */
export async function fetchKitchenOrders(db: SupabaseClient, truckId: string): Promise<KitchenOrder[]> {
  const { data, error } = await db
    .from("orders")
    .select(
      "id,ticket_ref,truck_id,service_date,slot_start,status,payment_method,payment_status,total_kwd,rejection_reason,placed_at,trucks(id,name),order_items(item_id,item_name,quantity,unit_price_kwd)",
    )
    .eq("truck_id", truckId)
    .eq("service_date", kuwaitNow().date)
    .order("slot_start")
    .order("placed_at");
  if (error) throw new Error(error.message);
  return data as unknown as KitchenOrder[];
}

/**
 * Asks the database to move an order to a new status. The database decides
 * whether this user may make this move (set_order_status) and answers with
 * the saved status, which is the only status the screen then shows.
 */
export async function setOrderStatus(
  db: SupabaseClient,
  orderId: string,
  status: OrderStatus,
  reason?: string,
): Promise<{ id: string; status: string; rejection_reason: string | null }> {
  const { data, error } = await db.rpc("set_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; status: string; rejection_reason: string | null };
}

// ---------------------------------------------------------------------------
// The park manager's dashboard
// ---------------------------------------------------------------------------

/** An order as the manager's dashboard reads it. */
export type ParkOrder = KitchenOrder & { updated_at: string };

export type ParkTruck = Truck & {
  /** When the park manager closed this truck for tonight, or null. */
  closedAt: string | null;
  /** Closed to new orders: by the manager for tonight, or by the vendor's own switch. */
  closed: boolean;
  /** Tonight's 24 slots with the database's own count of places taken. */
  slots: Slot[];
};

export type ParkTonight = { trucks: ParkTruck[]; orders: ParkOrder[] };

/** This account's role, as the database holds it. Only used to choose which screen to show. */
export async function fetchMyRole(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role ?? null;
}

/**
 * Tonight across the park: every truck, its closure state, its 24 slot
 * counts, and every order behind those counts.
 *
 * The counts come from the database function `slot_usage`, the same one the
 * customer's slot picker uses. The orders come from the `orders` table, and
 * row-level security returns all of them only to the park manager. Anyone
 * else calling this gets their own orders at most.
 */
export async function fetchParkTonight(db: SupabaseClient): Promise<ParkTonight> {
  const today = kuwaitNow().date;
  const [trucks, closures, orders] = await Promise.all([
    db.from("trucks").select("id,name,cuisine,blurb,slot_capacity,is_open").order("id"),
    db.from("truck_closures").select("truck_id,closed_at").eq("service_date", today),
    db
      .from("orders")
      .select(
        "id,ticket_ref,truck_id,service_date,slot_start,status,payment_method,payment_status,total_kwd,rejection_reason,placed_at,updated_at,trucks(id,name),order_items(item_id,item_name,quantity,unit_price_kwd)",
      )
      .eq("service_date", today)
      .order("slot_start")
      .order("placed_at"),
  ]);
  if (trucks.error) throw new Error(trucks.error.message);
  if (closures.error) throw new Error(closures.error.message);
  if (orders.error) throw new Error(orders.error.message);
  const closedAt = new Map(closures.data.map((c) => [c.truck_id as string, c.closed_at as string]));

  return {
    trucks: await Promise.all(
      trucks.data.map(async (truck) => ({
        ...truck,
        closedAt: closedAt.get(truck.id) ?? null,
        closed: !truck.is_open || closedAt.has(truck.id),
        slots: await fetchSlots(db, truck.id),
      })),
    ),
    orders: orders.data as unknown as ParkOrder[],
  };
}

/**
 * Asks the database to close a truck for tonight (close_truck_for_tonight).
 * The database refuses anyone who is not the park manager. It answers with
 * the saved closure, and only then does the screen show the truck as closed.
 */
export async function closeTruckForTonight(db: SupabaseClient, truckId: string): Promise<{ truck_id: string; closed_at: string }> {
  const { data, error } = await db.rpc("close_truck_for_tonight", { p_truck_id: truckId });
  if (error) throw new Error(error.message);
  const closure = data as { truck_id: string; closed_at: string } | null;
  if (!closure?.closed_at) throw new Error("closure_not_confirmed");
  return closure;
}

// ---------------------------------------------------------------------------
// The vendor's capacity setting
// ---------------------------------------------------------------------------

/**
 * Saves how many orders this truck takes per pickup time (1 to 20). It is
 * one number for the whole truck (`trucks.slot_capacity`), so it applies to
 * every pickup time.
 *
 * The database decides who may do this: row-level security lets only the
 * truck's assigned vendor update its row, and a check on the column refuses
 * anything outside 1 to 20. When the row is not this account's to change,
 * the database updates nothing and says so by returning no row.
 *
 * No order is touched. Orders already placed stay exactly as they are.
 */
export async function setTruckCapacity(db: SupabaseClient, truckId: string, capacity: number): Promise<number> {
  const { data, error } = await db.from("trucks").update({ slot_capacity: capacity }).eq("id", truckId).select("slot_capacity");
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("not_your_truck");
  return data[0].slot_capacity as number;
}

// ---------------------------------------------------------------------------
// The vendor's own controls: details, open or closed, price, sold out
// ---------------------------------------------------------------------------
//
// Each of these is a plain update of one row. The database decides whether
// it happens: its grants name the columns a signed-in user may change, and
// row-level security lets only the truck's assigned vendor change that
// truck's row or its dishes. When the row is not this account's to change,
// the database updates nothing and says so by returning no row, which is
// reported here as "not_your_truck" or "not_your_dish". Every function
// answers with what the database saved, and the screen shows that.

/** The two things that can stop new orders, kept apart. */
export type TruckState = {
  /** The vendor's own switch (trucks.is_open). */
  isOpen: boolean;
  /** The park manager closed this truck for tonight (a row in truck_closures). */
  closedByPark: boolean;
};

export async function fetchTruckState(db: SupabaseClient, truckId: string): Promise<TruckState> {
  const [truck, closure] = await Promise.all([
    db.from("trucks").select("is_open").eq("id", truckId).single(),
    db.from("truck_closures").select("truck_id").eq("truck_id", truckId).eq("service_date", kuwaitNow().date),
  ]);
  if (truck.error) throw new Error(truck.error.message);
  if (closure.error) throw new Error(closure.error.message);
  return { isOpen: truck.data.is_open as boolean, closedByPark: closure.data.length > 0 };
}

/**
 * The vendor's switch. It changes `trucks.is_open` and nothing else: no
 * order is touched, so tonight's tickets stay on the board to finish. It
 * cannot undo the park manager's closure, which is a separate row that
 * `place_order` also checks.
 */
export async function setTruckOpen(db: SupabaseClient, truckId: string, open: boolean): Promise<boolean> {
  const { data, error } = await db.from("trucks").update({ is_open: open }).eq("id", truckId).select("is_open");
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("not_your_truck");
  return data[0].is_open as boolean;
}

/** Saves the truck's name, cuisine and one-line description. */
export async function saveTruckDetails(
  db: SupabaseClient,
  truckId: string,
  details: { name: string; cuisine: string; blurb: string },
): Promise<Truck> {
  const { data, error } = await db
    .from("trucks")
    .update({ name: details.name, cuisine: details.cuisine, blurb: details.blurb })
    .eq("id", truckId)
    .select("id,name,cuisine,blurb,slot_capacity,is_open");
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("not_your_truck");
  return data[0] as Truck;
}

const DISH_COLUMNS = "id,truck_id,name,category,price_kwd,description,sold_out,allergens";

/**
 * Saves a dish's price. `price` is text with three decimals ("1.950"), so
 * no floating-point number is ever involved. Orders already placed keep the
 * price they were placed at: each order line has its own copy.
 */
export async function setDishPrice(db: SupabaseClient, itemId: string, price: string): Promise<MenuItem> {
  const { data, error } = await db.from("menu_items").update({ price_kwd: price }).eq("id", itemId).select(DISH_COLUMNS);
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("not_your_dish");
  return data[0] as MenuItem;
}

/** Marks a dish sold out, or puts it back on sale. */
export async function setDishSoldOut(db: SupabaseClient, itemId: string, soldOut: boolean): Promise<MenuItem> {
  const { data, error } = await db.from("menu_items").update({ sold_out: soldOut }).eq("id", itemId).select(DISH_COLUMNS);
  if (error) throw new Error(error.message);
  if (data.length !== 1) throw new Error("not_your_dish");
  return data[0] as MenuItem;
}

// ---------------------------------------------------------------------------
// The customer's rating of a collected order
// ---------------------------------------------------------------------------

export type Rating = { order_id: string; stars: number; comment: string | null; rated_at: string };

/** The saved rating for an order, or null when it has none. */
export async function fetchRating(db: SupabaseClient, orderId: string): Promise<Rating | null> {
  const { data, error } = await db
    .from("order_ratings")
    .select("order_id,stars,comment,rated_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Asks the database to save a rating (rate_order). The database checks that
 * this is the customer's own order, that it was collected, that the stars
 * are 1 to 5, and that it has not been rated before. It answers with the
 * saved rating, which is what the ticket then shows.
 */
export async function rateOrder(db: SupabaseClient, orderId: string, stars: number, comment: string | null): Promise<Rating> {
  const { data, error } = await db.rpc("rate_order", { p_order_id: orderId, p_stars: stars, p_comment: comment });
  if (error) throw new Error(error.message);
  return data as Rating;
}

// ---------------------------------------------------------------------------
// The signed-in account and its own orders
// ---------------------------------------------------------------------------

/** This account's role and name, as the database holds them. */
export async function fetchMyProfile(
  db: SupabaseClient,
  userId: string,
): Promise<{ role: string; display_name: string | null } | null> {
  const { data, error } = await db.from("profiles").select("role,display_name").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** An order as the customer's Orders list shows it. */
export type MyOrder = {
  id: string;
  ticket_ref: string;
  truck_id: string;
  service_date: string;
  slot_start: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_kwd: number;
  placed_at: string;
  trucks: { id: string; name: string } | null;
};

/**
 * This customer's own orders, newest first. Row-level security already
 * returns a customer only their own orders; asking for `customer_id` as
 * well keeps a vendor or manager account from listing a truck's orders here.
 */
export async function fetchMyOrders(db: SupabaseClient, customerId: string): Promise<MyOrder[]> {
  const { data, error } = await db
    .from("orders")
    .select("id,ticket_ref,truck_id,service_date,slot_start,status,payment_method,payment_status,total_kwd,placed_at,trucks(id,name)")
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return data as unknown as MyOrder[];
}

// ---------------------------------------------------------------------------
// The vendor's menu: descriptions and allergens
// ---------------------------------------------------------------------------

/**
 * The vendor's "Save". Asks the database to store a dish's description and
 * allergens (save_menu_copy). The database checks that the dish is on this
 * vendor's own truck and changes those two fields only: the price and the
 * sold-out switch are not even sent. It answers with the saved dish, which
 * is what the screen then shows.
 */
export async function saveMenuCopy(
  db: SupabaseClient,
  itemId: string,
  description: string,
  allergens: string[],
): Promise<MenuItem> {
  const { data, error } = await db.rpc("save_menu_copy", {
    p_item_id: itemId,
    p_description: description,
    p_allergens: allergens,
  });
  if (error) throw new Error(error.message);
  return data as MenuItem;
}
