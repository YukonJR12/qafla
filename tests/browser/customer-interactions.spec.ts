import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { dictionary, itemName, type Locale } from "../../lib/i18n";
import type { Order, Truck, MenuItem } from "../../lib/data";
import { parkWords } from "../../lib/park-map";

const id = "00000000-0000-4000-8000-000000000053";
const userId = "00000000-0000-4000-8000-000000000001";
const seed = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", "import { loadTrucks, loadMenuItems } from './scripts/lib/seed-csv.mjs'; console.log(JSON.stringify({ trucks: loadTrucks(), items: loadMenuItems() }));"], { encoding: "utf8" })) as { trucks: Truck[]; items: MenuItem[] };
const trucks = seed.trucks.map(t => ({ ...t, is_open: true }));
const items = seed.items.map(i => ({ ...i, allergens: [] }));
let server: Server;
let placements = 0;
let order: Order | null = null;
test.beforeAll(async () => {
  // Disposable HTTP fixture for both Next's server reads and browser reads.
  // No route in this test can reach the hosted database or a payment gateway.
  server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") return res.end();
    const url = new URL(req.url!, "http://127.0.0.1:54321");
    const reply = (value: unknown) => res.end(JSON.stringify(value));
    if (url.pathname.endsWith("/profiles")) return reply({ role: "customer", display_name: "Test Customer" });
    if (url.pathname.endsWith("/trucks")) return reply(url.searchParams.has("id") ? trucks.find(t => `eq.${t.id}` === url.searchParams.get("id")) : trucks);
    if (url.pathname.endsWith("/menu_items")) return reply(items.filter(i => (!url.searchParams.has("truck_id") || `eq.${i.truck_id}` === url.searchParams.get("truck_id")) && (!url.searchParams.has("id") || url.searchParams.get("id")!.includes(i.id))));
    if (url.pathname.endsWith("/truck_closures")) return reply([]);
    if (url.pathname.endsWith("/slot_usage")) return reply(Array.from({ length: 16 }, (_, n) => ({ slot_start: `${19 + Math.floor(n / 4)}:${String(n % 4 * 15).padStart(2, "0")}:00`, capacity: 10, booked: 0 })));
    if (url.pathname.endsWith("/orders")) return reply(url.searchParams.has("id") ? order : order ? [order] : []);
    if (url.pathname.endsWith("/place_order_paying")) {
      let body = ""; for await (const chunk of req) body += chunk;
      const p = JSON.parse(body) as { p_items: { item_id: string; quantity: number }[]; p_slot_start: string };
      placements++;
      order = { id, ticket_ref: "FIXTURE-000053", truck_id: "T01", service_date: "2026-11-22", slot_start: p.p_slot_start, status: "placed", payment_method: "pay_at_pickup", payment_status: "unpaid", total_kwd: .4, rejection_reason: null, trucks: trucks[0], order_items: p.p_items.map(i => ({ item_id: i.item_id, item_name: items.find(m => m.id === i.item_id)!.name, quantity: i.quantity, unit_price_kwd: Number(items.find(m => m.id === i.item_id)!.price_kwd) })) };
      return reply(order);
    }
    res.statusCode = 400; reply({ message: `Unsupported fixture: ${url.pathname}` });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(54321, "127.0.0.1", resolve); });
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
test.beforeEach(() => { order = null; placements = 0; });

async function session(page: Page, locale: Locale) {
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00Z"));
  await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
  await page.addInitScript(({ userId }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture", refresh_token: "fixture", expires_at: 9999999999, token_type: "bearer", user: { id: userId, email: "fixture@example.test" } }));
    Reflect.set(window, "receipts", 0);
    document.addEventListener("animationstart", event => { if (event.animationName === "receipt-arrive") Reflect.set(window, "receipts", Reflect.get(window, "receipts") + 1); });
  }, { userId });
  await page.route("**/*", route => ["http://127.0.0.1:3102", "http://127.0.0.1:54321"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  await page.routeWebSocket("ws://127.0.0.1:54321/**", ws => ws.onMessage(raw => {
    const [join, ref, channel, event, payload] = JSON.parse(String(raw));
    ws.send(JSON.stringify([join, ref, channel, "phx_reply", { status: "ok", response: event === "phx_join" ? { postgres_changes: payload.config.postgres_changes.map((f: object) => ({ ...f, id: 1 })) } : {} }]));
  }));
}

const journeys = [320, 390, 1440].flatMap(width => (["en", "ar"] as const).map(locale => ({ width, locale, reduced: false }))).concat({ width: 320, locale: "ar", reduced: true });
for (const { width, locale, reduced } of journeys) {
  test(`customer journey ${width} ${locale}${reduced ? " reduced" : ""}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await session(page, locale);
    const t = dictionary[locale], name = itemName(items[0], locale);
    const clip = width === 390 && locale === "en";
    const pause = async () => { if (clip) await page.waitForTimeout(1000); };
    await page.goto("/trucks/T01");
    await expect(page.getByRole("button", { name: t.addItem(name), exact: true })).toBeEnabled();
    await pause();
    const add = page.getByRole("button", { name: t.addItem(name), exact: true });
    if (width < 768) {
      const box = (await add.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else await add.dblclick({ delay: 50 });
    await expect(page.getByRole("group", { name: t.quantityOf(name, 2), exact: true })).toBeVisible();
    expect(await page.evaluate(userId => JSON.parse(localStorage.getItem(`qafla.cart.v2.${userId}`)!).items.M101, userId)).toBe(2);
    if (width < 1024) await expect(page.getByText(t.viewOrder(2), { exact: true })).toBeVisible();
    else await expect(page.getByRole("link", { name: t.cartWithCount(2), exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`menu-${width}-${locale}.png`), fullPage: true });
    await pause();
    if (width < 1024) await page.getByText(t.viewOrder(2), { exact: true }).click();
    else await page.getByRole("link", { name: t.cartWithCount(2), exact: true }).click();
    await page.getByRole("link", { name: t.choosePickup }).click();
    await expect(page.locator('input[name="payment"]:checked')).toHaveCount(0);
    await page.locator('input[name="payment"]').last().check();
    await pause();
    await page.getByRole("button", { name: new RegExp(t.placeOrder) }).click();
    await expect(page.getByText("FIXTURE-000053", { exact: true })).toBeVisible();
    await expect(page.locator(".receipt-arrive")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "receipts"))).toBe(reduced ? 0 : 1);
    if (reduced) expect(await page.locator(".receipt-arrive").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    expect(placements).toBe(1);
    expect(order!.order_items[0].quantity).toBe(2);
    await pause();
    const future = page.getByRole("list", { name: t.orderProgress }).getByRole("button").nth(3);
    await future.press("Enter");
    await expect(page.getByText(t.stagePreview(t.stageLabel.ready), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.cancelOrder, exact: true })).toBeVisible();
    await pause();
    await page.screenshot({ path: info.outputPath(`customer-${width}-${locale}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.reload();
    await expect(page.getByText("FIXTURE-000053", { exact: true })).toBeVisible();
    await expect(page.locator(".receipt-arrive")).toHaveCount(0);
    expect(placements).toBe(1);
    if (width < 768) {
      const nav = page.getByRole("navigation", { name: t.navLabel });
      await nav.getByRole("link", { name: t.nav.account, exact: true }).press("Enter");
      await expect(page).toHaveURL(/\/account$/);
      const link = nav.getByRole("link", { name: t.nav.account, exact: true });
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect.poll(async () => {
        const a = (await link.boundingBox())!, b = (await page.locator(".nav-indicator").boundingBox())!;
        return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
      }).toBeLessThan(1);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/orders/${id}$`));
      await expect(nav.getByRole("link", { name: t.nav.orders, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".receipt-arrive")).toHaveCount(0);
    }
  });
}

for (const width of [320, 390, 1440]) for (const locale of ["en", "ar"] as const) test(`payment server states and safe reopen ${width} ${locale}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 });
  await session(page, locale);
  const t = dictionary[locale];
  order = { id, ticket_ref: "FIXTURE-ONLINE", truck_id: "T01", service_date: "2026-11-22", slot_start: "19:00:00", status: "placed", payment_method: "online", payment_status: "unpaid", total_kwd: .4, rejection_reason: null, trucks: trucks[0], order_items: [] };
  let outcome = "awaiting", checks = 0, starts = 0;
  let release!: () => void;
  let gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/payments/start", route => { starts++; return route.abort(); });
  await page.route("**/api/payments/verify", async route => { checks++; await gate; await route.fulfill({ json: { outcome } }); });
  await page.goto(`/orders/${id}/payment?paymentId=fixture-payment`);
  await expect(page.getByRole("heading", { name: t.paymentConfirming })).toBeVisible();
  await expect(page.getByRole("heading", { name: t.paymentOutcome.paid.title })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`payment-verifying-${locale}.png`) });
  release();
  for (const next of ["awaiting", "failed", "paid"] as const) {
    if (next !== "awaiting") { outcome = next; gate = Promise.resolve(); await page.getByRole("button", { name: t.checkPayment, exact: true }).click(); }
    await expect(page.getByRole("heading", { name: t.paymentOutcome[next].title })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`payment-${next}-${locale}.png`) });
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: t.paymentOutcome.paid.title })).toBeVisible();
  expect(checks).toBe(4); expect(starts).toBe(0); expect(placements).toBe(0);
});

test("map sheet: Escape and touch dismissal preserve camera, focus and zoom", async ({ page }) => {
  await session(page, "en");
  await page.goto("/map");
  const canvas = page.locator("canvas[data-usable=true]");
  await expect(canvas).toBeVisible();
  const truck = page.locator('[data-truck="T01"]');
  await truck.press("Enter");
  const sheet = page.getByRole("dialog", { name: parkWords.en.details });
  await expect(sheet).toBeFocused();
  await page.waitForTimeout(900);
  const before = { azimuth: await canvas.getAttribute("data-azimuth"), zoom: await canvas.getAttribute("data-zoom") };
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0); await expect(truck).toBeFocused();
  await page.waitForTimeout(300);
  expect(await canvas.getAttribute("data-azimuth")).toBe(before.azimuth);
  expect(await canvas.getAttribute("data-zoom")).toBe(before.zoom);
  await truck.tap();
  await expect(sheet).toBeVisible();
  const handle = sheet.getByRole("button", { name: parkWords.en.close }).first();
  const box = (await handle.boundingBox())!;
  const cd = await page.context().newCDPSession(page);
  await cd.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 20, y: box.y + 10 }] });
  await cd.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 20, y: box.y + 120 }] });
  await cd.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveCount(0); await expect(truck).toBeFocused();
  expect(await canvas.getAttribute("data-zoom")).toBe(before.zoom);
});
