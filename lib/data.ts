import type { SupabaseClient } from "@supabase/supabase-js";
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
    .select("id,truck_id,name,category,price_kwd,description,sold_out")
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
      "id,ticket_ref,truck_id,service_date,slot_start,status,payment_method,total_kwd,rejection_reason,trucks(id,name),order_items(item_id,item_name,quantity,unit_price_kwd)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Order | null;
}
