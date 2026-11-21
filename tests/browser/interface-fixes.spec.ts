import { expect, test, type Route } from "@playwright/test";
import { dictionary } from "../../lib/i18n";

for (const width of [320, 390]) for (const locale of ["en", "ar"] as const) {
  test(`${width}px ${locale}: password reveal keeps text clear in both auth modes`, async ({ page }, testInfo) => {
    const t = dictionary[locale];
    const external: string[] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === "http://127.0.0.1:3102") return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    await page.goto("/sign-in");
    const password = page.getByLabel(t.password, { exact: true });
    for (const mode of ["sign-in", "sign-up"]) {
      await password.fill("ExampleOnly123");
      await expect(password).toHaveAttribute("type", "password");
      await page.getByRole("button", { name: t.showPassword, exact: true }).tap();
      await expect(password).toHaveAttribute("type", "text");
      const toggle = page.getByRole("button", { name: t.hidePassword, exact: true });
      const input = await password.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const css = getComputedStyle(el);
        return { left: box.left, right: box.right, paddingLeft: parseFloat(css.paddingLeft), paddingRight: parseFloat(css.paddingRight) };
      });
      const button = (await toggle.boundingBox())!;
      // The text's content box must end before the reveal button begins, in either locale.
      expect(input.left + input.paddingLeft).toBeLessThan(button.x);
      expect(input.right - input.paddingRight).toBeLessThanOrEqual(button.x + 1);
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`${mode}-${width}-${locale}.png`), fullPage: true });
      await password.focus();
      await page.keyboard.press("Tab");
      await expect(toggle).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(password).toHaveAttribute("type", "password");
      await page.keyboard.press("Space");
      await expect(password).toHaveAttribute("type", "text");
      await expect(password).toHaveValue("ExampleOnly123");
      await page.keyboard.press("Space");
      await expect(password).toHaveAttribute("type", "password");
      if (mode === "sign-in") await page.getByRole("button", { name: `${t.newHere} ${t.createAnAccount}`, exact: true }).tap();
    }
    expect(external).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });

  test(`${width}px ${locale}: profile errors focus, announce once and allow retry`, async ({ page }, testInfo) => {
    const t = dictionary[locale];
    let pending: Route | null = null;
    const saves: string[] = [];
    const unexpected: string[] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
    await page.addInitScript(() => {
      const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test" };
      localStorage.setItem("sb-127-auth-token", JSON.stringify({
        access_token: "fixture-access-token", refresh_token: "fixture-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user,
      }));
    });
    await page.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === "http://127.0.0.1:3102") return route.continue();
      if (url.origin === "http://127.0.0.1:54321") {
        if (url.pathname === "/rest/v1/profiles" && request.method() === "GET") {
          return route.fulfill({ json: { role: "customer", display_name: "Test Customer" } });
        }
        if (url.pathname === "/rest/v1/rpc/set_my_name" && request.method() === "POST") {
          saves.push(request.postDataJSON().p_name);
          pending = route;
          return;
        }
      }
      unexpected.push(`${request.method()} ${request.url()}`);
      return route.abort();
    });
    async function respond(error: string | null, name = "") {
      await expect.poll(() => pending !== null).toBe(true);
      const route = pending!;
      pending = null;
      await route.fulfill(error ? { status: 400, json: { message: error } } : { json: name });
    }

    await page.goto("/account");
    await page.getByRole("button", { name: t.editProfile, exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: t.personalDetails, exact: true });
    const name = dialog.getByRole("textbox", { name: t.nameOnly, exact: true });
    const save = dialog.getByRole("button", { name: t.saveChanges, exact: true });
    const alert = dialog.getByRole("alert");
    await name.fill("A".repeat(61));
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.keyboard.press("Tab");
      await expect(save).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(name).toBeFocused();
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(name).toHaveAccessibleDescription(t.nameTooLong);
    }
    expect(saves).toEqual([]);
    await expect(alert).toBeEmpty();
    await page.screenshot({ path: testInfo.outputPath(`name-validation-${width}-${locale}.png`), fullPage: true });

    // A server-side validation refusal uses the same focus path.
    await name.fill("A".repeat(60));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await respond("name_too_long");
    await expect(name).toBeFocused();
    await expect(name).toHaveAccessibleDescription(t.nameTooLong);

    const draft = locale === "ar" ? "اسم جديد" : "New Name";
    await name.fill(draft);
    await alert.evaluate((el) => {
      const changes: string[] = [];
      Reflect.set(window, "profileErrorAnnouncements", changes);
      new MutationObserver(() => {
        if (el.textContent?.trim()) changes.push(el.textContent.trim());
      }).observe(el, { childList: true, subtree: true, characterData: true });
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const busy = dialog.getByRole("button", { name: t.saving, exact: true });
    await expect(busy).toHaveAttribute("aria-disabled", "true");
    await expect(busy).toBeFocused();
    await page.keyboard.press("Enter"); // does not submit a second in-flight request
    await respond("unavailable");
    await expect(alert).toHaveText(t.saveCopyFailed);
    await expect(save).toBeFocused();
    await expect(name).toHaveValue(draft);
    await expect(name).not.toHaveAttribute("aria-invalid", "true");
    await expect(save).toHaveAttribute("aria-disabled", "false");
    expect(saves).toHaveLength(2);
    expect(await page.evaluate(() => Reflect.get(window, "profileErrorAnnouncements"))).toEqual([t.saveCopyFailed]);
    await page.screenshot({ path: testInfo.outputPath(`save-failure-${width}-${locale}.png`), fullPage: true });

    // A retry succeeds only in this mock; no hosted database is reachable.
    await page.keyboard.press("Enter");
    await respond(null, draft);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toHaveText(t.nameSaved);
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    expect(saves).toEqual(["A".repeat(60), draft, draft]);
    expect(unexpected).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
