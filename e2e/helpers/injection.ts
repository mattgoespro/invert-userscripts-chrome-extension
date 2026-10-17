import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "../fixtures";
import type { Userscript } from "@shared/model";
import { hashUserscriptCompileSources } from "@shared/compile-metadata";
import { getScriptModulePath } from "@shared/model";
import { createHash } from "node:crypto";
import { analyzeModule } from "../../packages/renderer/src/sandbox/module-analysis";
import type { ModuleManifest } from "@shared/modules/manifest";

export type CompiledSeed = {
  manifest?: ModuleManifest;
  javascript: string;
  css: string;
  build?: {
    version: 1;
    minifyCompiledOutput: boolean;
    sourceHash?: string;
    sourceDigest?: string;
    compilerContractVersion?: number;
  };
};

export function buildCompiledLocalEntry(
  script: Userscript,
  entry: { javascript: string; css: string }
): Record<string, CompiledSeed> {
  return {
    [`compiled:${script.id}`]: {
      javascript: entry.javascript,
      css: entry.css,
      manifest: analyzeModule(script.code.source.typescript, entry.javascript),
      build: {
        version: 1,
        minifyCompiledOutput: false,
        sourceHash: hashUserscriptCompileSources(script),
        sourceDigest: createHash("sha256")
          .update(
            JSON.stringify([
              script.code.source.typescript,
              script.code.source.scss,
              Boolean(script.shared),
              getScriptModulePath(script),
            ])
          )
          .digest("hex"),
        compilerContractVersion: 2,
      },
    },
  };
}

export async function openContentTab(
  context: BrowserContext,
  url: string
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return page;
}

export async function readHtmlOpacity(page: Page): Promise<string> {
  return page.evaluate(
    () => getComputedStyle(document.documentElement).opacity
  );
}

export async function readInvertMarker(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    document.documentElement.getAttribute("data-invert")
  );
}

export async function waitForInvertMarker(
  page: Page,
  expected: string | null,
  timeout = 15_000
): Promise<void> {
  await expect
    .poll(async () => readInvertMarker(page), { timeout })
    .toBe(expected);
}

export async function waitForHtmlOpacity(
  page: Page,
  expected: string,
  timeout = 15_000
): Promise<void> {
  await expect
    .poll(async () => readHtmlOpacity(page), { timeout })
    .toBe(expected);
}

/** Re-apply scripts from the options page (extension origin). */
export async function sendApplyScripts(
  optionsPage: Page,
  scriptIds: string[]
): Promise<void> {
  await optionsPage.evaluate(async (ids) => {
    await chrome.runtime.sendMessage({
      source: "options",
      type: "applyScripts",
      data: { scriptIds: ids },
    });
  }, scriptIds);
}

export function matchingExampleScript(
  overrides: Partial<Userscript> = {}
): Partial<Userscript> {
  return {
    enabled: false,
    shared: false,
    moduleName: "",
    urlPatterns: ["https://example.com/*"],
    runAt: "afterPageLoad",
    ...overrides,
  };
}
