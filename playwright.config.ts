import { defineConfig } from "@playwright/test";

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
        bypassCSP: true, // Allow the extension to load its scripts without CSP issues
        viewport: null,
      },
    },
  ],
});
