import { defineConfig } from "@playwright/test";

// Pass HEADLESS=true to run in headless mode (requires Chrome 112+ new-headless).
// Extensions work with the new headless mode used by Playwright ≥1.45.
const headless = process.env["HEADLESS"] === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [["html", { outputFolder: "e2e/report", open: "never" }], ["list"]],
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "chromium",
      use: {
        headless,
        bypassCSP: true, // Allow the extension to load its scripts without CSP issues
        viewport: null,
      },
    },
  ],
});
