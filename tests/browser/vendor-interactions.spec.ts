import { test, expect, type Page } from "@playwright/test";
import { dictionary, truckName, type Locale } from "../../lib/i18n";
import { formatKwd } from "../../lib/money";

const truck = { id: "T02", name: "Dune Burgers", cuisine: "Burgers", blurb: "", slot_capacity: 6, is_open: true };
const originalDish = { id: "M201", truck_id: "T02", name: "Classic smash", price_kwd: 1.95, description: "Original menu copy", allergens: ["gluten"], sold_out: false, category: "Food" };
const photo = "public/dishes/M201.webp";
async function fixture(page: Page, locale: Locale) {
  let dish = { ...originalDish }, capacity = 6, status = "preparing";
  const calls = { ai: 0, copy: 0, price: 0, capacity: 0, status: 0 };
  let fail = "";
  await page.clock.setFixedTime(new Date("2026-11-22T16:00:00Z"));
  await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
  await page.addInitScript(() => localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture", refresh_token: "fixture", expires_at: 9999999999, token_type: "bearer", user: { id: "00000000-0000-4000-8000-000000000001", email: "vendor@example.test" } })));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.pathname === "/api/menu/suggest") {
      calls.ai++; await new Promise(resolve => setTimeout(resolve, 250));
      return route.fulfill({ json: { suggestion: { description: `Reviewed photo draft ${calls.ai}`, allergens: ["gluten", "milk"] }, remaining: 8, model: "controlled-fixture" } });
    }
    if (url.origin === "http://127.0.0.1:3102") return route.continue();
    if (url.origin !== "http://127.0.0.1:54321") return route.abort();
    const reply = (json: unknown) => route.fulfill({ json });
    if (url.pathname.endsWith("/profiles")) return reply({ role: "vendor", display_name: "Dune vendor" });
    if (url.pathname.endsWith("/trucks")) {
      if (method === "PATCH") { calls.capacity++; await new Promise(resolve => setTimeout(resolve, 200)); if (fail === "capacity") return route.fulfill({ status: 500, json: { message: "fixture_failure" } }); capacity = route.request().postDataJSON().slot_capacity; return reply([{ slot_capacity: capacity }]); }
      return reply({ ...truck, slot_capacity: capacity });
    }
    if (url.pathname.endsWith("/menu_items")) {
      if (method === "PATCH") { calls.price++; await new Promise(resolve => setTimeout(resolve, 200)); if (fail === "price") return route.fulfill({ status: 500, json: { message: "fixture_failure" } }); dish = { ...dish, ...route.request().postDataJSON() }; return reply([dish]); }
      return reply([dish]);
    }
    if (url.pathname.endsWith("/save_menu_copy")) { calls.copy++; const p = route.request().postDataJSON(); dish = { ...dish, description: p.p_description, allergens: p.p_allergens }; return reply(dish); }
    if (url.pathname.endsWith("/slot_usage")) return reply([{ slot_start: "19:30:00", capacity, booked: 2 }]);
    if (url.pathname.endsWith("/truck_closures")) return reply([]);
    if (url.pathname.endsWith("/orders")) return reply([{ id: "00000000-0000-4000-8000-000000000053", ticket_ref: "FIXTURE-T02", truck_id: "T02", service_date: "2026-11-22", slot_start: "19:30:00", status, payment_method: "pay_at_pickup", payment_status: "unpaid", total_kwd: 1.95, rejection_reason: null, placed_at: "2026-11-22T15:00:00Z", trucks: truck, order_items: [{ item_id: "M201", item_name: "Classic smash", quantity: 1, unit_price_kwd: 1.95 }] }]);
    if (url.pathname.endsWith("/set_order_status")) { calls.status++; await new Promise(resolve => setTimeout(resolve, 200)); if (fail === "status") return route.fulfill({ status: 500, json: { message: "fixture_failure" } }); status = route.request().postDataJSON().p_status; return reply({ id: "00000000-0000-4000-8000-000000000053", status, rejection_reason: null }); }
    return route.abort();
  });
  return { calls, fail: (action: string) => { fail = action; }, saved: () => ({ dish, capacity, status }) };
}
for (const width of [320, 390, 1440]) for (const locale of ["en", "ar"] as const) {
  test(`vendor photo draft and explicit review ${width} ${locale}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: width === 320 ? "reduce" : "no-preference" });
    const api = await fixture(page, locale), t = dictionary[locale];
    await page.goto("/vendor/menu/M201");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(photo);
    await expect(page.getByRole("img", { name: t.photoChosen })).toBeVisible();
    expect(api.calls).toEqual({ ai: 0, copy: 0, price: 0, capacity: 0, status: 0 });
    await page.getByRole("button", { name: locale === "ar" ? "إزالة الصورة" : "Remove photo" }).click();
    await expect(page.getByRole("img", { name: t.photoChosen })).toHaveCount(0);
    await input.setInputFiles(photo);
    await page.getByRole("button", { name: t.suggest, exact: true }).click();
    await expect(page.getByRole("button", { name: locale === "ar" ? "جارٍ إنشاء المسودة…" : "Generating draft…" })).toBeDisabled();
    await page.getByRole("button", { name: t.useSuggestion, exact: true }).click();
    const confirm = page.getByRole("checkbox", { name: t.confirmAllergens });
    const save = page.getByRole("button", { name: t.saveForCustomers, exact: true });
    await expect(save).toBeDisabled();
    await confirm.focus(); await page.keyboard.press("Space");
    await expect(save).toBeEnabled();
    await page.getByRole("button", { name: t.suggest, exact: true }).click();
    await expect(confirm).not.toBeChecked();
    await page.getByRole("button", { name: t.useSuggestion, exact: true }).click();
    await expect(save).toBeDisabled();
    await confirm.check();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`vendor-review-${width}-${locale}.png`), fullPage: true });
    await save.click();
    await expect(page.getByText(t.savedCopy, { exact: true })).toBeVisible();
    expect(api.calls.ai).toBe(2); expect(api.calls.copy).toBe(1);
    expect(api.saved().dish.description).toBe("Reviewed photo draft 2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: info.outputPath(`vendor-saved-${width}-${locale}.png`), fullPage: true });
  });
  test(`vendor retry-safe price capacity and Ready ${width} ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await fixture(page, locale), t = dictionary[locale];
    await page.goto("/vendor/menu/M201");
    const price = page.getByRole("textbox", { name: t.priceLabel });
    await price.fill("2.100"); api.fail("price");
    const save = page.getByRole("button", { name: t.savePrice, exact: true });
    const before = (await save.boundingBox())!.width;
    await save.click();
    await expect(page.getByRole("button", { name: t.saving, exact: true })).toBeDisabled();
    const retry = page.getByRole("button", { name: `${t.retry}: ${t.savePrice}`, exact: true });
    await expect(retry).toBeEnabled(); expect((await retry.boundingBox())!.width).toBe(before);
    await expect(price).toHaveValue("2.100"); expect(api.saved().dish.price_kwd).toBe(1.95);
    api.fail(""); await retry.click(); await expect(page.getByText(t.priceSaved(formatKwd("2.100", locale)), { exact: true })).toBeVisible();
    expect(api.calls.price).toBe(2);
    await page.goto("/vendor/capacity");
    await page.getByRole("button", { name: t.capacityMore }).click(); api.fail("capacity");
    await page.getByRole("button", { name: t.capacitySave(truckName(truck, locale)), exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(`^${t.retry}:`) })).toBeEnabled(); expect(api.saved().capacity).toBe(6);
    api.fail(""); await page.getByRole("button", { name: new RegExp(`^${t.retry}:`) }).click();
    await expect(page.getByRole("button", { name: locale === "ar" ? "تم تحديث الطاقة" : "Capacity updated" })).toBeDisabled();
    expect(api.calls.capacity).toBe(2); expect(api.saved().capacity).toBe(7);
    await page.goto("/vendor"); api.fail("status");
    await page.getByRole("button", { name: t.kitchenAction.ready, exact: true }).click();
    await expect(page.getByRole("button", { name: `${t.retry}: ${t.kitchenAction.ready}`, exact: true })).toBeEnabled(); expect(api.saved().status).toBe("preparing");
    api.fail(""); await page.getByRole("button", { name: `${t.retry}: ${t.kitchenAction.ready}`, exact: true }).click();
    await expect(page.getByRole("button", { name: t.kitchenAction.collected, exact: true })).toBeEnabled();
    expect(api.saved().status).toBe("ready"); expect(api.calls.status).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
