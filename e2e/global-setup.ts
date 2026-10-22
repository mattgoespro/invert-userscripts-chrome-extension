import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { createHash } from "node:crypto";

export default async function globalSetup() {
  const manifestPath = path.resolve(
    import.meta.dirname,
    "../dist/manifest.json"
  );

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "[e2e] dist/manifest.json not found.\nRun `pnpm run build` before running the e2e suite."
    );
  }

  const optionsPath = path.join(path.dirname(manifestPath), "options.js");
  const optionsHash = createHash("sha256")
    .update(fs.readFileSync(optionsPath))
    .digest("hex");
  console.log(`[e2e] Extension build: ${path.dirname(manifestPath)}`);
  console.log(`[e2e] options.js SHA-256: ${optionsHash}`);

  try {
    const executablePath = chromium.executablePath();

    if (!fs.existsSync(executablePath)) {
      throw new Error("missing browser");
    }
  } catch {
    throw new Error(
      "[e2e] Playwright Chromium is not installed.\nRun `pnpm run e2e:install` before running the e2e suite."
    );
  }
}
