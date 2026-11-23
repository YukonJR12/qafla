import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startDatabase, asUser } from "../db/harness.mjs";

test("submission: five two-customer last-slot races against PostgreSQL", async ({ browser }) => {
  test.setTimeout(180_000);
  const out = "docs/evidence/submission-race";
  await mkdir(out, { recursive: true });
  const db = await startDatabase();
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const rounds: unknown[] = [];
  const queued: (() => void)[] = [];
  let armed = false;
  try {
    const today = (await db.admin.query("select (now() at time zone 'Asia/Kuwait')::date::text d")).rows[0].d;
    await db.admin.query("insert into test.clock(at) values (($1::date + '15:00'::time) at time zone 'Asia/Kuwait')", [today]);
    const users = (await db.admin.query("insert into auth.users(email) values ('race-a@example.test'),('race-b@example.test'),('prefill@example.test') returning id,email")).rows;
    const results: { customer: string; outcome: string; ticket?: string }[] = [];
    async function sql(user: string, text: string, values: unknown[] = []) {
      const c = await db.connect();
      try { return await asUser(c, user, (conn: { query: (text: string, values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => conn.query(text, values)); }
      finally { await c.end(); }
    }
    for (let i = 0; i < 2; i++) {
      const user = users[i];
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: "test-results/race-video", size: { width: 390, height: 844 } } });
      contexts.push(context);
      const page = await context.newPage(); pages.push(page);
      await page.clock.setFixedTime(new Date(today + "T12:00:00Z"));
      await page.addInitScript(user => {
        localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_at: 9999999999, token_type: "bearer", user }));
      }, user);
      await page.route("**/*", async route => {
        const u = new URL(route.request().url());
        if (u.origin === "http://127.0.0.1:3102") return route.continue();
        if (u.origin !== "http://127.0.0.1:54321") return route.abort();
        try {
          let data: unknown;
          if (u.pathname.endsWith("/profiles")) data = (await sql(user.id, "select role, display_name from profiles where id=$1", [user.id])).rows[0];
          else if (u.pathname.endsWith("/menu_items")) data = (await sql(user.id, "select * from menu_items where truck_id='T02' order by id")).rows;
          else if (u.pathname.endsWith("/trucks")) data = (await sql(user.id, "select * from trucks where id='T02'")).rows[0];
          else if (u.pathname.endsWith("/truck_closures")) data = (await sql(user.id, "select * from truck_closures where truck_id='T02'")).rows;
          else if (u.pathname.endsWith("/slot_usage")) data = (await sql(user.id, "select * from slot_usage('T02')")).rows;
          else if (u.pathname.endsWith("/place_order_paying")) {
            const body = route.request().postDataJSON();
            if (armed) await new Promise<void>(resolve => { queued.push(resolve); if (queued.length === 2) { armed = false; queued.splice(0).forEach(go => go()); } });
            try {
              data = (await sql(user.id, "select * from place_order_paying($1,$2::time,$3::jsonb,$4::uuid,$5)", [body.p_truck_id, body.p_slot_start, JSON.stringify(body.p_items), body.p_request_id, body.p_payment_method])).rows[0];
              results.push({ customer: user.email, outcome: "saved", ticket: (data as { ticket_ref: string }).ticket_ref });
            } catch (e) { results.push({ customer: user.email, outcome: (e as Error).message }); throw e; }
          } else if (u.pathname.endsWith("/orders")) {
            const id = u.searchParams.get("id")?.replace(/^eq\./, "");
            data = (await sql(user.id, "select o.*, json_build_object('id',t.id,'name',t.name) trucks, (select json_agg(oi) from order_items oi where oi.order_id=o.id) order_items from orders o join trucks t on t.id=o.truck_id where o.id=$1", [id])).rows[0] ?? null;
          } else if (u.pathname.endsWith("/order_ratings")) data = [];
          else return route.abort();
          await route.fulfill({ json: data });
        } catch (e) { await route.fulfill({ status: 400, json: { message: (e as Error).message } }); }
      });
      await page.goto("/cart");
    }
    for (let round = 0; round < 5; round++) {
      const slot = `${17 + Math.floor(round / 4)}:${String(round % 4 * 15).padStart(2, "0")}:00`;
      for (let j = 0; j < 5; j++) await sql(users[2].id, `select * from place_order('T02',$1::time,'[{"item_id":"M201","quantity":1}]'::jsonb,gen_random_uuid())`, [slot]);
      const count = async () => Number((await db.admin.query("select count(*) n from orders where truck_id='T02' and slot_start=$1::time and status not in ('rejected','cancelled')", [slot])).rows[0].n);
      const before = await count(); expect(before).toBe(5);
      for (let i = 0; i < 2; i++) {
        await pages[i].evaluate(({ user, slot }) => {
          localStorage.setItem(`qafla.cart.v2.${user.id}`, JSON.stringify({ ownerId: user.id, truckId: "T02", truckName: "Dune Burgers", items: { M201: 1 }, slot, payment: "pay_at_pickup" }));
        }, { user: users[i], slot });
        await pages[i].goto("/checkout");
        await expect(pages[i].getByRole("button", { name: /Place order/ })).toBeVisible();
        // The selected slot says Selected; reveal the actual capacity read in an evidence caption.
        await pages[i].evaluate(({ round, before, slot, customer }) => {
          const banner = document.createElement("div");
          banner.textContent = `ISOLATED POSTGRES · Customer ${customer} · Round ${round}/5 · ${slot} · ${before}/6 booked · 1 place remaining`;
          banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;background:#c6f900;color:#111;font: bold 12px sans-serif;padding:8px";
          document.body.append(banner);
        }, { round: round + 1, before, slot, customer: i ? "B" : "A" });
        await pages[i].screenshot({ path: `${out}/round-${round + 1}-${i ? "b" : "a"}-before.png` });
      }
      await pages[0].waitForTimeout(1200);
      armed = true; results.length = 0;
      await Promise.all(pages.map(page => page.getByRole("button", { name: /Place order/ }).click()));
      await expect.poll(() => results.length).toBe(2);
      expect(results.map(r => r.outcome).sort()).toEqual(["saved", "slot_full"]);
      const winner = results.find(r => r.outcome === "saved")!;
      const winIndex = users[0].email === winner.customer ? 0 : 1;
      await expect(pages[winIndex]).toHaveURL(/\/orders\//);
      await expect(pages[winIndex].getByText(winner.ticket!, { exact: true })).toBeVisible();
      await expect(pages[1 - winIndex].getByRole("alert").filter({ hasText: /filled/ })).toBeVisible();
      const after = await count(); expect(after).toBe(6);
      rounds.push({ round: round + 1, slot, before, after, delta: after - before, results: [...results] });
      for (let i = 0; i < 2; i++) {
        await pages[i].evaluate(({ round, after, won }) => {
          const banner = document.createElement("div");
          banner.textContent = `ISOLATED POSTGRES · Round ${round}/5 · ${won ? "CONFIRMED TICKET" : "SLOT FULL / RECOVERY"} · ${after}/6 booked · gained exactly 1`;
          banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:10000;background:#c6f900;color:#111;font:bold 12px sans-serif;padding:8px";
          document.body.append(banner);
        }, { round: round + 1, after, won: i === winIndex });
        await pages[i].screenshot({ path: `${out}/round-${round + 1}-${i ? "b" : "a"}-after.png` });
      }
      await pages[0].waitForTimeout(1800);
    }
    await writeFile(out + "/results.json", JSON.stringify({ environment: "local production Next.js build; real embedded PostgreSQL 17; test auth shim and HTTP adapter; no hosted database", date: today, rounds }, null, 2));
  } finally {
    for (let i = 0; i < contexts.length; i++) {
      const video = pages[i].video();
      await contexts[i].close();
      if (video) await video.saveAs(`${out}/customer-${i ? "b" : "a"}.webm`);
    }
    await db.stop();
  }
});
