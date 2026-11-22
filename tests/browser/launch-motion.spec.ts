import { expect, test } from "@playwright/test";
import { dictionary } from "../../lib/i18n";

test("launch paints the official logo even while application JavaScript is unavailable", async ({ page }, info) => {
  const imageRequests: string[] = [];
  page.on("request", request => { if (request.resourceType() === "image") imageRequests.push(request.url()); });
  await page.route("**/*.js", route => route.abort());
  await page.goto("/");
  const logo = page.locator(".launch img");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /^data:image\/webp;base64,/);
  expect(await logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 256)).toBe(true);
  expect(imageRequests).toEqual([]);
  await page.screenshot({ path: info.outputPath("launch-without-javascript.png") });
});

for (const reduced of [false, true]) for (const returning of [false, true]) {
  test(`launch ${returning ? "saved session" : "fresh"}, ${reduced ? "320 Arabic reduced" : "390 English motion"}`, async ({ page }, info) => {
    const locale = reduced ? "ar" : "en";
    await page.setViewportSize({ width: reduced ? 320 : 390, height: 844 });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.context().addCookies([{ name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" }]);
    await page.addInitScript(({ returning }) => {
      if (returning) localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "fixture", refresh_token: "fixture", expires_at: 9999999999, token_type: "bearer", user: { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test" } }));
      const events: object[] = [];
      Reflect.set(window, "launchEvents", events);
      document.addEventListener("animationstart", event => {
        if (event.animationName !== "launch-roll" && event.animationName !== "launch-handoff") return;
        const logo = document.querySelector<HTMLImageElement>(".launch img");
        events.push({ name: event.animationName, decoded: !!logo?.complete && !!logo.naturalWidth, pointer: getComputedStyle(document.querySelector(".launch")!).pointerEvents });
      });
    }, { returning });
    await page.route("http://127.0.0.1:54321/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/profiles")) return route.fulfill({ json: { role: "customer", display_name: "Fixture" } });
      if (path.endsWith("/orders")) return route.fulfill({ json: [] });
      return route.abort();
    });
    // Orders is a real returning workspace and needs no server-side fixture API.
    await page.goto(returning ? "/orders" : "/");
    const destination = returning ? page.getByRole("heading", { name: dictionary[locale].ordersTitle, exact: true }) : page.getByRole("button", { name: dictionary[locale].signIn, exact: true });
    await expect(destination).toBeVisible();
    await expect(destination).toBeEnabled();
    await expect(page.locator(".launch")).toHaveCount(0);
    const events = await page.evaluate(() => Reflect.get(window, "launchEvents")) as { name: string; decoded: boolean; pointer: string }[];
    const roll = events.filter(e => e.name === "launch-roll");
    expect(roll).toHaveLength(reduced ? 0 : 1);
    if (!reduced) expect(roll[0].decoded).toBe(true);
    expect(events.find(e => e.name === "launch-handoff")?.pointer).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(reduced ? 320 : 390);
    await page.screenshot({ path: info.outputPath("destination.png") });
  });
}
