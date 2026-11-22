import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  dashboard,
  generateHistory,
  TRUCKS,
  REPLAY,
  validate,
} from "../../lib/rush";
const out = "docs/evidence/rush-shared-data";
const fixtureHistory=generateHistory().map(r=>({...r,day:Math.round((Date.parse(r.serviceDate+"T00:00:00Z")-Date.parse("1970-01-04T00:00:00Z"))/86400000)}));
const fixtureData={serviceDate:"2026-11-23",now:1140,history:fixtureHistory.concat(fixtureHistory.filter(r=>r.serviceDate==="2026-11-22").map(r=>({...r,day:r.day+1,serviceDate:"2026-11-23"})))};
async function fixture(page: Page, locale: string, role = "manager") {
  await page
    .context()
    .addCookies([
      { name: "qafla_locale", value: locale, url: "http://127.0.0.1:3102" },
    ]);
  await page.addInitScript(() =>
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: "fixture-manager",
        refresh_token: "fixture-refresh",
        expires_at: 9999999999,
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "manager@example.test",
        },
      }),
    ),
  );
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:3102") return route.continue();
    if (url.origin !== "http://127.0.0.1:54321") return route.abort();
    if (url.pathname.endsWith("/profiles"))
      return route.fulfill({ json: { role, display_name: "Dana" } });
    if (url.pathname.endsWith("/trucks"))
      return route.fulfill({
        json: TRUCKS.map((t) => ({
          id: t.id,
          name: t.en,
          slot_capacity: t.capacity,
          is_open: true,
          cuisine: "",
          blurb: "",
        })),
      });
    if (url.pathname.endsWith("/forecast_history")) return route.fulfill({json:fixtureData});
    if (url.pathname.endsWith("/slot_usage"))
      return route.fulfill({ json: [] });
    if (
      url.pathname.endsWith("/orders") ||
      url.pathname.endsWith("/truck_closures")
    )
      return route.fulfill({ json: [] });
    return route.abort();
  });
}
for (const width of [320, 390, 1440])
  for (const locale of ["en", "ar"]) {
    test(`rush ${width} ${locale}`, async ({ page }, info) => {
      await mkdir(out, { recursive: true });
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, locale);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/manager");
      await page
        .getByRole("link", {
          name: locale === "ar" ? "التوقع" : "Forecast",
          exact: true,
        })
        .click();
      await expect(page.locator(".rush")).toBeVisible();
      await page.getByRole("button", {name: locale === "ar" ? "إعادة عرض الأمسية" : "Replay the evening",exact:true}).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      for (let i = 0; i < REPLAY.length; i++) {
        await page.locator(".rush-times[aria-label] button").nth(i).press("Enter");
        const expected = dashboard(fixtureHistory, fixtureHistory.at(-1)!.day, REPLAY[i]);
        await expect(page.getByTestId("risk-count")).toHaveText(
          String(expected.risk.length),
        );
        await expect(page.getByTestId("expected-count")).toHaveText(
          String(Number(expected.expected.toFixed(1))),
        );
        const detail = page.getByTestId("forecast-detail");
        const current = expected.cells.find(
          (f) => f.truck === "T04" && f.slot === "19:45:00",
        )!;
        await expect(detail.getByTestId("projection")).toHaveText(
          `${Number(current.projected.toFixed(1))} / ${current.capacity}`,
        );
        await expect(detail.getByRole("img")).toHaveAccessibleName(
          locale === "ar"
            ? `المحجوز ${current.current}، المتوقع ${Number(current.projected.toFixed(1))}، النطاق ${current.low} إلى ${current.high}، السعة ${current.capacity}`
            : `Observed ${current.current}, projected ${Number(current.projected.toFixed(1))}, range ${current.low} to ${current.high}, capacity ${current.capacity}`,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await expect(page.locator(".rush-outcome")).toBeVisible();
      await page.screenshot({
        path: `${out}/${width}-${locale}-outcome.png`,
        fullPage: true,
      });
      await page.locator(".rush-times[aria-label] button").first().click();
      if (width < 768) {
        await page.locator(".rush-ranked button").first().tap();
      } else {
        await page
          .locator(".rush-cell")
          .filter({ hasText: "5/5" })
          .first()
          .click();
      }
      await expect(page.getByTestId("forecast-detail")).toBeVisible();
      await page.route("**/api/manager/forecast/explain", async (route) => {
        const sent = route.request().postDataJSON();
        expect(sent.now).toBe(REPLAY[0]);
        expect(sent.locale).toBe(locale);
        expect(sent.truck).toBe(
          await page.getByTestId("forecast-detail").getAttribute("data-truck"),
        );
        expect(sent.slot).toBe(
          await page.getByTestId("forecast-detail").getAttribute("data-slot"),
        );
        return route.fulfill({
          status: 503,
          json: { error: "provider_unavailable" },
        });
      });
      await page.locator(".rush-explain").press("Enter");
      await expect(page.locator(".rush-explain")).toBeEnabled();
      await expect(page.locator(".rush-explanation")).toContainText(
        locale === "ar" ? "شرح مستند إلى الحجوزات" : "Booking-based explanation",
      );
      await page.screenshot({
        path: `${out}/${width}-${locale}.png`,
        fullPage: true,
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/${width}-${locale}-dashboard.png`,
      });
      expect(errors).toEqual([]);
      await info.attach("assertions", {
        body: JSON.stringify({
          width,
          locale,
          steps: 3,
          kpisMatchModel: true,
          overflow: false,
          fallback: true,
        }),
        contentType: "application/json",
      });

      await writeFile(
        `${out}/validation.json`,
        JSON.stringify(validate(), null, 2),
      );
    });
  }
test("customer cannot open forecast", async ({ page }) => {
  await fixture(page, "en", "customer");
  // Explore is server-rendered and its DB is deliberately unavailable in this fixture.
  // Assert the gate requests the customer destination, not completion of its server fetch.
  const redirected = page.waitForRequest(r => new URL(r.url()).pathname === "/explore");
  await page.goto("/manager?view=forecast");
  await redirected;
  await expect(page.locator(".rush")).toHaveCount(0);
});

test("20-second mobile replay walkthrough", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: "test-results/rush-video",
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  await fixture(page, "en");
  await page.goto("/manager?view=forecast");
  await expect(page.locator(".rush")).toBeVisible();
  await page.getByRole("button",{name:"Replay the evening",exact:true}).click();
  await page.screenshot({ path: `${out}/mobile-start.png` });
  await page.waitForTimeout(2500);
  await page.locator(".rush-ranked").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.locator(".rush-ranked button").first().tap();
  await page.waitForTimeout(4500);
  await page.locator(".rush-times[aria-label] button").nth(1).tap();
  await page.waitForTimeout(3000);
  await page.locator(".rush-times[aria-label] button").nth(2).tap();
  await page.locator(".rush-outcome").scrollIntoViewIfNeeded();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/mobile-result.png` });
  const video = page.video();
  await context.close();
  await video?.saveAs(`${out}/mobile-replay.webm`);
});
