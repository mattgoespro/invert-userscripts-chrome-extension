import { test, expect, buildUserscript } from "../fixtures";
import { waitForStoredTypescript } from "../helpers/chrome-sync";
import {
  expectNoModuleImportErrors,
  expandProblemsDrawer,
  listQuickFixTitles,
  saveMonacoEditor,
  waitForTypescriptEditorText,
} from "../helpers/monaco";
import { OptionsPage, ScriptsPage } from "../page-objects";

/**
 * Shared-module IntelliSense must stay valid across script switches.
 *
 * Regression for: consumer Y opens with TS2307 on `scripts/<x>/main`, clearing
 * after visiting X, then returning after visiting unrelated shared Z.
 */
test.describe("Scripts — shared module imports", () => {
  test.describe.configure({ timeout: 45_000 });
  test("consumer opens clean and stays clean across script switches", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const exporter = buildUserscript({
      name: "Logger | Utility",
      moduleName: "logger",
      shared: true,
      sharedScripts: [],
      code: {
        source: {
          typescript: [
            "export function createLogger(name: string) {",
            "  return (...args: unknown[]) => console.log(name, ...args);",
            "}",
          ].join("\n"),
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    const unrelated = buildUserscript({
      name: "Pretty Stringify | Utility",
      moduleName: "pretty-stringify",
      shared: true,
      sharedScripts: [],
      code: {
        source: {
          typescript: [
            "export function prettyStringify(value: unknown): string {",
            "  return JSON.stringify(value, null, 2);",
            "}",
          ].join("\n"),
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    // Deliberately leave sharedScripts empty so IntelliSense must resolve the
    // dependency from the TypeScript import (and keep shared modules resident).
    const consumer = buildUserscript({
      name: "DOM Utils | Utility",
      moduleName: "dom-utils",
      shared: true,
      sharedScripts: [],
      code: {
        source: {
          typescript: [
            'import { createLogger } from "scripts/logger/main";',
            "",
            'const log = createLogger("DOM Utils | Utility");',
            "",
            "export function isParentFrame(window: Window): boolean {",
            "  return window === window.top;",
            "}",
            "",
            "log(isParentFrame(window));",
          ].join("\n"),
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${exporter.id}`]: exporter,
      [`userscript:${unrelated.id}`]: unrelated,
      [`userscript:${consumer.id}`]: consumer,
      globalState: {
        activeSidebarTab: "scripts",
        selectedScriptId: consumer.id,
        outputDrawerCollapsed: false,
      },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();

    await expect(scripts.scriptNameInput).toHaveValue("DOM Utils | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(
      optionsPage,
      'from "scripts/logger/main"'
    );
    await expectNoModuleImportErrors(optionsPage);

    await scripts.selectScript("Logger | Utility", "createLogger");
    await expectNoModuleImportErrors(optionsPage);

    await scripts.selectScript(
      "DOM Utils | Utility",
      'from "scripts/logger/main"'
    );
    await expectNoModuleImportErrors(optionsPage);

    await scripts.selectScript("Pretty Stringify | Utility", "prettyStringify");
    await expectNoModuleImportErrors(optionsPage);

    await scripts.selectScript(
      "DOM Utils | Utility",
      'from "scripts/logger/main"'
    );
    await expectNoModuleImportErrors(optionsPage);
  });

  test("quick-fix offers import of an exported shared function", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildUserscript({
      name: "Pretty Stringify | Utility",
      moduleName: "pretty-stringify",
      shared: true,
      sharedScripts: [],
      code: {
        source: {
          typescript: [
            "export function prettyStringify(value: unknown): string {",
            "  return JSON.stringify(value);",
            "}",
          ].join("\n"),
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    const logger = buildUserscript({
      name: "Logger | Utility",
      moduleName: "logger",
      shared: true,
      sharedScripts: [],
      code: {
        source: {
          typescript: [
            "export function log(message: string): string {",
            "  return prettyStringify(message);",
            "}",
          ].join("\n"),
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${prettyStringify.id}`]: prettyStringify,
      [`userscript:${logger.id}`]: logger,
      globalState: {
        activeSidebarTab: "scripts",
        selectedScriptId: logger.id,
        outputDrawerCollapsed: false,
      },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue("Logger | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(optionsPage, "prettyStringify");
    await expandProblemsDrawer(optionsPage);
    await expect(
      optionsPage.locator("[data-testid='output-drawer']")
    ).toContainText("Cannot find name 'prettyStringify'", { timeout: 15_000 });

    const titles = await listQuickFixTitles(optionsPage, "prettyStringify");

    expect(
      titles.some((title) =>
        /Add import from ["']scripts\/pretty-stringify\/main["']/.test(title)
      ),
      `Expected an auto-import quick-fix for prettyStringify.\nFixes:\n${titles.join("\n") || "(none)"}`
    ).toBe(true);
  });

  test("Ctrl+S succeeds when importing a non-shared scripts/<id>/main module", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const exporterId = "a8ee5963-bf40-462a-a423-d613e70fc13b";
    const exporter = buildUserscript({
      id: exporterId,
      name: "Logger | Utility",
      moduleName: exporterId,
      shared: false,
      sharedScripts: [],
      code: {
        source: {
          typescript:
            "export function createLogger() { return () => undefined; }",
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    const consumer = buildUserscript({
      name: "DOM Interaction | Utilities",
      moduleName: "",
      shared: false,
      sharedScripts: [],
      code: {
        source: {
          typescript: `import { createLogger } from "scripts/${exporterId}/main";`,
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${exporter.id}`]: exporter,
      [`userscript:${consumer.id}`]: consumer,
      globalState: {
        activeSidebarTab: "scripts",
        selectedScriptId: consumer.id,
        outputDrawerCollapsed: true,
      },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue(
      "DOM Interaction | Utilities",
      { timeout: 15_000 }
    );

    const savedSource = `import { createLogger } from "scripts/${exporterId}/main"; export const saved = 1;`;
    await scripts.replaceTypescriptCode(savedSource);
    await saveMonacoEditor(optionsPage);
    await waitForStoredTypescript(optionsPage, {
      name: "DOM Interaction | Utilities",
      includes: `from "scripts/${exporterId}/main"`,
    });
    await waitForStoredTypescript(optionsPage, {
      name: "DOM Interaction | Utilities",
      includes: "export const saved = 1",
    });
  });
});
