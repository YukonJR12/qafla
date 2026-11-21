import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3102",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    video: { mode: "on", size: { width: 390, height: 844 } },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm start --hostname 127.0.0.1 -p 3102",
    url: "http://127.0.0.1:3102/sign-in",
    reuseExistingServer: false,
    timeout: 120_000,
    // Never use the project's shared database, even if interception fails.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
    },
  },
});
