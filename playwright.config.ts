import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3377",
    actionTimeout: 10_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npx tsx src/tests/e2e/test-server.ts",
    port: 3377,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
