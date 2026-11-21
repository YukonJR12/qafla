import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { dictionary, truckName, type Locale } from "../../lib/i18n";
import { STAGES } from "../../lib/ticket";

const orderId = "00000000-0000-4000-8000-000000000053";

/** The real ticket page with a fake session, REST reads and Realtime transport. */
async function ticketFixture(page: Page, locale: Locale) {
  let status = "placed";
  let socket: WebSocketRoute;
  let topic = "";
  let reads = 0;
  const writes: string[] = [];
  await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
  await page.addInitScript(() => {
    const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test" };
    localStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "fixture-access-token", refresh_token: "fixture-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user,
    }));
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3102") return route.continue();
    if (request.method() !== "GET") writes.push(`${request.method()} ${url.pathname}`);
    if (url.origin !== "http://127.0.0.1:54321" || request.method() !== "GET") return route.abort();
    if (url.pathname === "/rest/v1/profiles") {
      return route.fulfill({ json: { role: "customer", display_name: "Test Customer" } });
    }
    if (url.pathname === "/rest/v1/orders") {
      reads++;
      return route.fulfill({ json: {
        id: orderId, ticket_ref: "FIXTURE-000053", truck_id: "T01", service_date: "2026-11-21",
        slot_start: "19:15:00", status, payment_method: "pay_at_pickup", payment_status: "unpaid",
        total_kwd: 0.950, rejection_reason: null, trucks: { id: "T01", name: "Karak Corner" },
        order_items: [
          { item_id: "M101", item_name: "Karak tea", quantity: 1, unit_price_kwd: 0.200 },
          { item_id: "M102", item_name: "Cheese toastie", quantity: 1, unit_price_kwd: 0.750 },
        ],
      } });
    }
    throw new Error(`Unexpected fixture request: ${request.url()}`);
  });
  await page.routeWebSocket("ws://127.0.0.1:54321/**", (ws) => {
    socket = ws;
    ws.onMessage((raw) => {
      const [joinRef, ref, channel, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") topic = channel;
      ws.send(JSON.stringify([joinRef, ref, channel, "phx_reply", {
        status: "ok", response: event === "phx_join"
          ? { postgres_changes: payload.config.postgres_changes.map((filter: object) => ({ ...filter, id: 1 })) }
          : {},
      }]));
    });
  });
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole("list", { name: dictionary[locale].orderProgress })).toBeVisible();
  await expect.poll(() => topic).toContain(`ticket-${orderId}`);
  return {
    writes,
    async advance(next: string) {
      status = next;
      const before = reads;
      socket.send(JSON.stringify([null, null, topic, "postgres_changes", { ids: [1], data: {
        schema: "public", table: "orders", type: "UPDATE", commit_timestamp: new Date().toISOString(),
        columns: [{ name: "id", type: "uuid" }, { name: "status", type: "text" }],
        record: { id: orderId, status }, old_record: { id: orderId }, errors: [],
      } }]));
      await expect.poll(() => reads).toBeGreaterThan(before);
    },
  };
}

for (const width of [320, 390]) for (const locale of ["en", "ar"] as const) {
  test(`${width}px ${locale}: preview is local; live Ready resets and announces once`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Pace one recording for human review; these pauses are not synchronization.
    const recording = width === 390 && locale === "en";
    await page.setViewportSize({ width, height: 844 });
    const fixture = await ticketFixture(page, locale);
    const t = dictionary[locale];
    const truck = truckName({ id: "T01", name: "Karak Corner" }, locale);
    const list = page.getByRole("list", { name: t.orderProgress });
    const buttons = list.getByRole("button");
    const caption = page.locator("#progress-title + div p[aria-live]");
    const badge = page.locator("main .rounded-full").filter({ hasText: t.statusName.placed });
    const back = page.getByRole("button", { name: t.backToCurrentStage, exact: true });

    async function remainsPlaced() {
      await expect(badge).toHaveText(t.statusName.placed);
      await expect(buttons.nth(0)).toHaveAttribute("aria-current", "step");
      await expect(list.locator("[aria-current=step]")).toHaveCount(1);
      await expect(list.getByText(t.stageDone(t.statusName.placed), { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: t.cancelOrder, exact: true })).toBeVisible();
      await expect(page.getByText(t.statusHelp.ready, { exact: true })).toHaveCount(0);
      expect(fixture.writes).toEqual([]);
    }

    // All five real touch targets, their labels, and the fixed bottom bar.
    for (let i = 0; i < STAGES.length; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await button.tap();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      if (i > 0) await expect(caption).toContainText(t.stagePreview(t.stageLabel[STAGES[i]]));
      await remainsPlaced();
      if (recording) await page.waitForTimeout(900);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await buttons.nth(3).tap();
    await expect(caption).toContainText(t.stageExplanation.ready);
    if (recording) await page.waitForTimeout(1800);
    // Do not derive the required English copy from the implementation.
    if (locale === "en") await expect(caption).toHaveText("Stage preview · ReadyWhen the kitchen marks your order ready, you can collect it at the truck.");
    await page.screenshot({ path: testInfo.outputPath(`preview-${width}-${locale}.png`), fullPage: true });
    await back.tap();
    await expect(caption).toHaveText(t.timelineCaption.placed(truck));
    await expect(back).toHaveCount(0);
    if (recording) await page.waitForTimeout(900);

    // Native Tab order, Enter and Space in both document directions.
    await buttons.nth(0).focus();
    for (let i = 0; i < STAGES.length; i++) {
      await expect(buttons.nth(i)).toBeFocused();
      await page.keyboard.press(i % 2 ? "Space" : "Enter");
      await expect(buttons.nth(i)).toHaveAttribute("aria-pressed", "true");
      if (i > 0) await expect(caption).toContainText(t.stagePreview(t.stageLabel[STAGES[i]]));
      await remainsPlaced();
      await page.keyboard.press("Tab");
    }
    await expect(back).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(caption).toHaveText(t.timelineCaption.placed(truck));

    await buttons.nth(4).tap();
    await fixture.advance("placed");
    await expect(caption).toContainText(t.stagePreview(t.stageLabel.collected));
    if (recording) await page.waitForTimeout(900);
    // Observe the stable live region, including duplicate transport messages.
    await caption.evaluate((element) => {
      const changes: string[] = [];
      Reflect.set(window, "stageAnnouncements", changes);
      new MutationObserver(() => changes.push(element.textContent ?? "")).observe(element, {
        childList: true, subtree: true, characterData: true,
      });
    });
    await fixture.advance("ready");
    await expect(caption).toHaveText(t.timelineCaption.ready(truck));
    await expect(back).toHaveCount(0);
    await expect(buttons.nth(3)).toHaveAttribute("aria-current", "step");
    await expect(buttons.nth(3)).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 3; i++) await expect(buttons.nth(i)).toHaveAccessibleName(t.stageDone(t.statusName[STAGES[i]]));
    await expect(page.getByRole("button", { name: t.cancelOrder, exact: true })).toHaveCount(0);
    await expect(page.getByText(t.statusHelp.ready, { exact: true })).toBeVisible();
    await expect(page.locator("main .rounded-full").filter({ hasText: t.statusName.ready })).toBeVisible();
    await fixture.advance("ready");
    // Wait for that read to render before counting notifications.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.evaluate(() => Reflect.get(window, "stageAnnouncements"))).toEqual([t.timelineCaption.ready(truck)]);
    await expect(page.getByText(t.statusHelp.ready, { exact: true }).locator("xpath=ancestor::*[@role='status']")).toHaveCount(0);
    expect(fixture.writes).toEqual([]);
    expect(errors).toEqual([]);
    if (recording) await page.waitForTimeout(1200);
    await page.screenshot({ path: testInfo.outputPath(`live-ready-${width}-${locale}.png`), fullPage: true });
  });
}
