import { expect, test } from "@playwright/test";
import { dictionary } from "../../lib/i18n";

for (const width of [320, 390]) for (const locale of ["en", "ar"] as const) {
  test(`cart and explicit payment ${width} ${locale}`, async ({ page }, info) => {
    const t = dictionary[locale];
    const writes: string[] = [];
    const methods: string[] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date("2026-11-22T12:00:00Z"));
    await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
    await page.addInitScript(() => {
      const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test" };
      localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_at: 9999999999, token_type: "bearer", user }));
      if (!localStorage.getItem("cart-fixture")) {
        localStorage.setItem("cart-fixture", "1");
        localStorage.setItem(`qafla.cart.v2.${user.id}`, JSON.stringify({ ownerId: user.id, truckId: "T01", truckName: "Karak Corner", items: { M103: 1, M104: 1 }, slot: null }));
      }
    });
    await page.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin === "http://127.0.0.1:3102") return route.continue();
      if (u.origin !== "http://127.0.0.1:54321") return route.abort();
      const path = u.pathname;
      if (path.endsWith("/profiles")) return route.fulfill({ json: { role: "customer", display_name: "Test Customer" } });
      if (path.endsWith("/menu_items")) return route.fulfill({ json: [
        { id: "M103", truck_id: "T01", name: "Cheese and zaatar toastie", price_kwd: .75, sold_out: false, allergens: [] },
        { id: "M104", truck_id: "T01", name: "Chips oman sandwich", price_kwd: .5, sold_out: false, allergens: [] },
      ] });
      if (path.endsWith("/trucks")) return route.fulfill({ json: { is_open: true } });
      if (path.endsWith("/truck_closures")) return route.fulfill({ json: [] });
      if (path.endsWith("/slot_usage")) return route.fulfill({ json: Array.from({ length: 12 }, (_, i) => ({ slot_start: `${17 + Math.floor(i / 4)}:${String(i % 4 * 15).padStart(2, "0")}:00`, capacity: 10, booked: 0 })) });
      writes.push(path);
      if (path.endsWith("/place_order_paying")) methods.push(route.request().postDataJSON().p_payment_method);
      return route.fulfill({ status: 400, json: { message: "not_a_customer" } });
    });
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: t.yourItems })).toBeVisible();
    await expect(page.locator('img[src*="M103"]')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`cart-${width}-${locale}.png`), fullPage: true });
    await page.getByRole("link", { name: t.choosePickup }).click();
    const payment = page.locator('input[name="payment"]');
    await expect(payment).toHaveCount(2);
    await expect(page.locator('input[name="payment"]:checked')).toHaveCount(0);
    await expect(page.locator('input[name="pickup-slot"]')).toHaveCount(4);
    const action = page.getByRole("button", { name: new RegExp(t.choosePayment) });
    await action.click();
    await expect(payment.first()).toBeFocused();
    expect(writes).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`checkout-unselected-${width}-${locale}.png`), fullPage: true });
    await payment.first().press("Space");
    await expect(payment.first()).toBeChecked();
    await expect(page.getByRole("button", { name: new RegExp(t.placeAndPay) })).toBeVisible();
    await page.reload();
    await expect(payment.first()).toBeChecked();
    await payment.last().check();
    await expect(payment.last()).toBeChecked();
    await page.getByRole("button", { name: t.laterTimes }).click();
    await expect(page.locator('input[name="pickup-slot"]')).toHaveCount(12);
    await page.locator("label").filter({ has: page.locator('input[name="pickup-slot"][value="19:45:00"]') }).tap();
    await page.getByRole("button", { name: t.fewerTimes }).click();
    await expect(page.locator('input[name="pickup-slot"]:checked')).toHaveValue("19:45:00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`checkout-selected-${width}-${locale}.png`), fullPage: true });
    await page.getByRole("button", { name: new RegExp(t.placeOrder) }).click();
    await expect.poll(() => writes).toEqual(["/rest/v1/rpc/place_order_paying"]);
    expect(methods).toEqual(["pay_at_pickup"]);
    await expect(page.getByText(t.notCustomer, { exact: true })).toBeVisible();
    await payment.first().check();
    await page.getByRole("button", { name: new RegExp(t.placeAndPay) }).click();
    await expect.poll(() => methods).toEqual(["pay_at_pickup", "online"]);
  });
}

