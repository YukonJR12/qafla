import { writeFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { parkWords, PARK_TRUCKS } from "../../lib/park-map";
import { dictionary, truckName, type Locale } from "../../lib/i18n";

const names = ["Karak Corner", "Dune Burgers", "Taco Saha", "Noodle Wagon", "Saj Station", "Lugaimat & Co"];
const order = "00000000-0000-4000-8000-000000000054";
async function fixture(page: Page, locale: Locale, noGL = false) {
  const writes: string[] = [];
  await page.clock.setFixedTime(new Date("2026-11-21T15:00:00Z"));
  await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
  await page.addInitScript(({ noGL }) => {
    const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test" };
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_at: 9999999999, token_type: "bearer", user }));
    const stats = window as unknown as { parkDraws: number }; stats.parkDraws = 0;
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args: Parameters<typeof draw>) { stats.parkDraws++; return draw.apply(this, args); };
    if (noGL) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        if (String(args[0]).includes("webgl")) return null;
        return original.apply(this, args);
      } as typeof original;
    }
  }, { noGL });
  await page.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === "http://127.0.0.1:3102") return route.continue();
    if (url.origin !== "http://127.0.0.1:54321") return route.abort();
    if (url.pathname === "/rest/v1/rpc/slot_usage") return route.fulfill({ json: [{ slot_start: "19:15:00", booked: 0, capacity: 10 }] });
    if (req.method() !== "GET") { writes.push(url.pathname); return route.abort(); }
    if (url.pathname === "/rest/v1/profiles") return route.fulfill({ json: { role: "customer", display_name: "Test Customer" } });
    if (url.pathname === "/rest/v1/trucks") return route.fulfill({ json: PARK_TRUCKS.map((t, i) => ({ id: t.id, name: names[i], cuisine: ["Tea and snacks", "Burgers", "Tacos", "Noodles", "Saj wraps", "Desserts"][i], blurb: ["Karak, toasties and quick bites.", "Smash burgers cooked to order.", "Street tacos with Gulf twists.", "Wok noodles, fresh off the flame.", "Wraps made on the saj in front of you.", "Lugaimat, kunafa and cold drinks."][i], slot_capacity: 10, is_open: i !== 1 })) });
    if (url.pathname === "/rest/v1/truck_closures" || url.pathname === "/rest/v1/menu_items") return route.fulfill({ json: [] });
    if (url.pathname === "/rest/v1/orders") return route.fulfill({ json: {
      id: order, ticket_ref: "FIXTURE-READY-T02", truck_id: "T02", service_date: "2026-11-21", slot_start: "19:15:00", status: "ready", payment_method: "pay_at_pickup", payment_status: "unpaid", total_kwd: 1.950, rejection_reason: null, trucks: { id: "T02", name: "Dune Burgers" }, order_items: [{ item_id: "M201", item_name: "Classic smash", quantity: 1, unit_price_kwd: 1.950 }],
    } });
    throw new Error("Unexpected fixture URL: " + url.pathname);
  });
  await page.routeWebSocket("ws://127.0.0.1:54321/**", (ws) => {
    ws.onMessage((raw) => {
      const [join, ref, channel, event, payload] = JSON.parse(String(raw));
      ws.send(JSON.stringify([join, ref, channel, "phx_reply", { status: "ok", response: event === "phx_join" ? { postgres_changes: payload.config.postgres_changes.map((f: object) => ({ ...f, id: 1 })) } : {} }]));
    });
  });
  return writes;
}

for (const width of [320, 390]) for (const locale of ["en", "ar"] as const) {
  test(`park ${width} ${locale}: six targets, rotate, selection, Ready deep link`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    const writes = await fixture(page, locale);
    const w = parkWords[locale];
    await page.goto("/account");
    const nav = page.getByRole("navigation", { name: dictionary[locale].navLabel });
    await expect(nav.getByRole("link", { name: w.map, exact: true })).toBeVisible();
    const before = await page.evaluate(() => performance.now());
    await nav.getByRole("link", { name: w.map, exact: true }).tap();
    await expect(page.locator("canvas[data-usable=true]")).toBeVisible({ timeout: 30_000 });
    const usableMs = await page.evaluate(() => performance.now()) - before;
    await info.attach("load-time", { body: JSON.stringify({ usableMs, width, locale, browser: await page.context().browser()!.version(), renderer: "Chromium software WebGL, desktop emulation, no network throttle" }), contentType: "application/json" });
    const park = page.getByTestId("park");
    await expect(park).toHaveAttribute("data-ready", "true");
    const targets = page.locator("[data-truck]");
    await expect(targets).toHaveCount(6);
    for (const target of await targets.all()) {
      const b = (await target.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(43.9); expect(b.height).toBeGreaterThanOrEqual(43.9);
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(width);
      await target.tap();
      await expect(page.getByRole("region", { name: w.details })).toBeVisible();
      await page.getByRole("button", { name: w.reset, exact: true }).tap();
      await expect(targets).toHaveCount(6);
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: info.outputPath(`park-${width}-${locale}.png`) });
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.72, { steps: 20 });
    await page.mouse.up();
    await expect(park).toHaveAttribute("data-selected", "");
    await page.screenshot({ path: info.outputPath(`rotated-${width}-${locale}.png`) });
    await page.locator('[data-truck="T01"]').tap();
    await expect(park).toHaveAttribute("data-selected", "T01");
    await expect(page.getByRole("region", { name: w.details })).toContainText(truckName({ id: "T01", name: names[0] }, locale));
    await expect(page.getByRole("link", { name: w.menu, exact: true })).toHaveAttribute("href", "/trucks/T01");
    await page.waitForTimeout(1000);
    const selected = (await page.locator('[data-truck="T01"]').boundingBox())!;
    const sheet = (await page.getByRole("region", { name: w.details }).boundingBox())!;
    expect(selected.y + selected.height).toBeLessThan(sheet.y);
    await page.screenshot({ path: info.outputPath(`selected-${width}-${locale}.png`) });
    await page.goto(`/orders/${order}`);
    await page.getByRole("link", { name: w.find }).tap();
    await expect(park).toHaveAttribute("data-selected", "T02");
    await expect(page.locator("canvas[data-usable=true]")).toBeVisible();
    await expect(page.getByRole("region", { name: w.details })).toContainText(dictionary[locale].pausedNow);
    await expect(page.getByRole("link", { name: w.menu, exact: true })).toHaveAttribute("href", "/trucks/T02");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: info.outputPath(`ready-truck-${width}-${locale}.png`) });
    await page.getByRole("button", { name: w.list, exact: true }).press("Enter");
    await expect(page.getByRole("link", { name: /Karak|كرك/ }).first()).toBeVisible();
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
test("without WebGL the existing keyboard truck list remains available", async ({ page }) => {
  await fixture(page, "en", true);
  await page.goto("/map");
  await expect(page.getByText(parkWords.en.fallback)).toBeVisible();
  await page.getByRole("button", { name: parkWords.en.list, exact: true }).first().press("Enter");
  await expect(page.getByRole("link", { name: /Karak Corner/ }).first()).toBeVisible();
});
test("reduced motion and invalid truck IDs", async ({ page }) => {
  await fixture(page, "ar");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map?truck=not-a-truck");
  await expect(page.locator("canvas[data-usable=true]")).toBeVisible();
  await expect(page.getByTestId("park")).toHaveAttribute("data-selected", "");
  await page.locator('[data-truck="T05"]').press("Enter");
  await expect(page.getByTestId("park")).toHaveAttribute("data-selected", "T05");
  await page.getByRole("button", { name: parkWords.ar.reset }).press("Enter");
  await expect(page.locator("[data-truck]")).toHaveCount(6);
});

test("recording: rotate real geometry, Karak sheet, then Ready Dune location; pinch and idle", async ({ page }, info) => {
  test.setTimeout(90_000);
  const writes = await fixture(page, "en");
  await page.goto("/account");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Map", exact: true })).toBeVisible();
  const start = await page.evaluate(() => performance.now());
  await page.getByRole("navigation").getByRole("link", { name: "Map", exact: true }).tap();
  await expect(page.locator("canvas[data-usable=true]")).toBeVisible();
  const timing = await page.evaluate(() => {
    const gl = document.querySelector("canvas")!.getContext("webgl2")!;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return { now: performance.now(), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), userAgent: navigator.userAgent };
  });
  const metrics = { ...timing, usableMs: timing.now - start };
  await writeFile(info.outputPath("metrics.json"), JSON.stringify(metrics, null, 2));
  await info.attach("map-timing", { body: JSON.stringify(metrics), contentType: "application/json" });
  await page.waitForTimeout(1200);
  const c = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.78, c.y + c.height * 0.72, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await page.locator('[data-truck="T01"]').tap();
  await expect(page.getByRole("region", { name: "Truck details" })).toContainText("Karak Corner");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: info.outputPath("karak-sheet.png") });
  await page.goto(`/orders/${order}`);
  await expect(page.getByRole("link", { name: "Find my truck" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("link", { name: "Find my truck" }).tap();
  await expect(page.getByTestId("park")).toHaveAttribute("data-selected", "T02");
  await expect(page.locator("canvas[data-usable=true]")).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: info.outputPath("ready-dune.png") });
  const draws = () => page.evaluate(() => (window as unknown as { parkDraws: number }).parkDraws);
  const settled = await draws();
  await page.waitForTimeout(600);
  expect(await draws()).toBe(settled);
  const labelBefore = await page.locator('[data-truck="T02"]').boundingBox();
  const cd = await page.context().newCDPSession(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cd.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 30, y }, { x: x + 30, y }] });
  for (let d = 35; d <= 65; d += 5) await cd.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - d, y }, { x: x + d, y }] });
  await cd.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  expect(await draws()).toBeGreaterThan(settled);
  const labelAfter = await page.locator('[data-truck="T02"]').boundingBox();
  expect(Math.abs(labelAfter!.y - labelBefore!.y)).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Reset view" }).tap();
  await expect(page.locator("[data-truck]")).toHaveCount(6);
  await page.waitForTimeout(900);
  // Simulate GPU context loss; the list remains reachable.
  await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.dispatchEvent(new Event("webglcontextlost")));
  await expect(page.getByText(parkWords.en.fallback)).toBeVisible();
  await page.getByRole("button", { name: "Truck list", exact: true }).first().press("Enter");
  await expect(page.getByRole("link", { name: /Karak Corner/ }).first()).toBeVisible();
  expect(writes).toEqual([]);
});



