import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTruckMenu } from "../../lib/data";

test("menu reads start together, read truck once, and retain live closure precedence", async () => {
  for (const state of [{ open: true, park: false, why: null }, { open: false, park: false, why: "vendor" }, { open: false, park: true, why: "park" }]) {
    const calls: string[] = [];
    let release!: (value: unknown) => void;
    const truck = new Promise(resolve => { release = resolve; });
    const db = {
      from(table: string) {
        calls.push(table);
        const result = table === "trucks" ? truck : Promise.resolve({ data: table === "truck_closures" && state.park ? [{ truck_id: "T01" }] : [], error: null });
        const query = { select: () => query, eq: () => query, order: () => query, maybeSingle: () => result, then: result.then.bind(result) };
        return query;
      },
      rpc() { calls.push("slot_usage"); return Promise.resolve({ data: [{ slot_start: "17:00:00", capacity: 10, booked: 9 }], error: null }); },
    } as unknown as SupabaseClient;
    const reading = fetchTruckMenu(db, "T01");
    expect(calls).toEqual(["trucks", "menu_items", "slot_usage", "truck_closures"]);
    release({ data: { id: "T01", is_open: state.open }, error: null });
    const menu = await reading;
    expect(menu.why).toBe(state.why);
    expect(menu.slots[0].booked).toBe(9);
  }
});
