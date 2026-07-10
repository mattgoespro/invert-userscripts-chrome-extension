import { defineConfig } from "@playwright/test";

// Headless by default. Pass `--headed` to open a visible browser window.
// Extensions require Chrome's new headless mode (Playwright ≥1.45).
const headless = !process.argv.includes("--headed");

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
  outputDir: "./e2e/report",
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
