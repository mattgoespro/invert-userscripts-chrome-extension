import { type Page } from "@playwright/test";
import { test, expect, buildUserscript } from "../fixtures";
import {
  expectCannotFindName,
  expectNoEditorProblems,
  listQuickFixTitles,
  replaceMonacoEditorContent,
  waitForTypeDefinitionsEditorText,
  waitForTypescriptEditorText,
} from "../helpers/monaco";
import { OptionsPage, ScriptsPage } from "../page-objects";

/**
 * Matches the Invert IDE types pane: a plain type alias, not `declare global`.
 * The types buffer is `types.d.ts`, so this stays a page global for the owning
 * script even with `moduleDetection: Force` on `.ts` userscript models.
 */
const prettyStringifyTypeBody = [
  "  objectKeyModifier?: (key: string) => string;",
  "  objectValueModifier?: (value: unknown) => string;",
  "  sortObjectKeys?: boolean;",
  "  quoteStrings?: boolean;",
].join("\n");

const prettyStringifyTypeJsdoc = [
  "/**",
  " * Options for formatting JSON objects.",
  " *",
  " * @property { (key: string) => string } [objectKeyModifier] - A function to modify object keys.",
  " * @property { (value: unknown) => string } [objectValueModifier] - A function to modify object values.",
  " * @property { boolean } [sortObjectKeys] - Whether to sort object keys.",
  " * @property { boolean } [quoteStrings] - Whether to quote string values.",
  " */",
].join("\n");

/** Ambient pane (no import/export): own-script page global only. */
const prettyStringifyTypes = [
  prettyStringifyTypeJsdoc,
  "type PrettyStringifyOptions = {",
  prettyStringifyTypeBody,
  "};",
].join("\n");

/** Module pane: import-only via `scripts/<m>/types`, including the owner. */
const prettyStringifyExportedTypes = [
  prettyStringifyTypeJsdoc,
  "export type PrettyStringifyOptions = {",
  prettyStringifyTypeBody,
  "};",
].join("\n");

const prettyStringifySource = [
  "export function prettyStringify(",
  "  value: unknown,",
  "  options: PrettyStringifyOptions,",
  "  indent = 0",
  "): string {",
  "  const keyModifier = options?.objectKeyModifier ?? ((key) => key);",
  "  const valueModifier = options?.objectValueModifier ?? ((value) => `${value}`);",
  '  return `${keyModifier("a")}: ${valueModifier(value)} ${indent}`;',
  "}",
].join("\n");

const loggerTypes = [
  "type LoggerOptions = PrettyStringifyOptions & {",
  "  level?: string;",
  "};",
  "",
  "declare function createLogger(name: string, options?: LoggerOptions): void;",
].join("\n");

const loggerSource = [
  'createLogger("Logger | Utility", { quoteStrings: true });',
].join("\n");

const loggerImportedTypesSource = [
  'import type { PrettyStringifyOptions } from "scripts/pretty-stringify/types";',
  "",
  "const options: PrettyStringifyOptions = { quoteStrings: true };",
  "void options;",
].join("\n");

const loggerUnresolvedTypeSource = [
  "const options: PrettyStringifyOptions = { quoteStrings: true };",
  "void options;",
].join("\n");

function buildPrettyStringify(typeDefinitions = prettyStringifyTypes) {
  return buildUserscript({
    name: "Pretty Stringify | Utility",
    moduleName: "pretty-stringify",
    shared: true,
    typeDefinitions,
    code: {
      source: { typescript: prettyStringifySource, scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
}

function buildLogger(options?: {
  typeDefinitions?: string;
  typescript?: string;
}) {
  return buildUserscript({
    name: "Logger | Utility",
    moduleName: "logger",
    shared: true,
    typeDefinitions: options?.typeDefinitions ?? loggerTypes,
    code: {
      source: {
        typescript: options?.typescript ?? loggerSource,
        scss: "",
      },
      compiled: { javascript: "", css: "" },
    },
  });
}

async function seedScripts(
  optionsPage: Page,
  clearStorage: (page: Page) => Promise<void>,
  seedStorage: (page: Page, data: Record<string, unknown>) => Promise<void>,
  scripts: ReturnType<typeof buildUserscript>[],
  selected: ReturnType<typeof buildUserscript>
) {
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, {
    ...Object.fromEntries(
      scripts.map((script) => [`userscript:${script.id}`, script])
    ),
    globalState: {
      activeSidebarTab: "scripts",
      selectedScriptId: selected.id,
      outputDrawerCollapsed: false,
    },
  });
  await optionsPage.reload();
}

function expectAutoImportFrom(titles: string[], specifier: string) {
  expect(
    titles.some(
      (title) =>
        title.includes(`Add import from "${specifier}"`) ||
        title.includes(`Add import from '${specifier}'`)
    ),
    `Expected an auto-import quick-fix from ${specifier}.\nFixes:\n${titles.join("\n") || "(none)"}`
  ).toBe(true);
}

/**
 * Unexported types-pane names are own-script ambient globals. `export type`
 * is import-only via `scripts/<m>/types`. Other scripts never see unexported
 * names as free identifiers.
 */
test.describe("Scripts — type declaration resolution", () => {
  test.describe.configure({ timeout: 60_000 });

  test("own type pane globals resolve in the userscript", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildPrettyStringify();

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify],
      prettyStringify
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue(
      "Pretty Stringify | Utility",
      { timeout: 15_000 }
    );
    await waitForTypescriptEditorText(optionsPage, "PrettyStringifyOptions");
    await expectNoEditorProblems(optionsPage);
  });

  test("own ambient types resolve after selecting a previously unopened script", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildPrettyStringify();
    const logger = buildLogger({
      typeDefinitions: "",
      typescript: [
        "export function log(message: string): void {",
        "  console.log(message);",
        "}",
      ].join("\n"),
    });

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify, logger],
      logger
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue("Logger | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(optionsPage, "export function log");

    await scripts.selectScript(
      "Pretty Stringify | Utility",
      "PrettyStringifyOptions"
    );
    await expectNoEditorProblems(optionsPage);
  });

  test("own type pane export type is import-only", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildPrettyStringify(prettyStringifyExportedTypes);

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify],
      prettyStringify
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue(
      "Pretty Stringify | Utility",
      { timeout: 15_000 }
    );
    await waitForTypescriptEditorText(optionsPage, "PrettyStringifyOptions");
    await expectCannotFindName(optionsPage, "PrettyStringifyOptions");

    const titles = await listQuickFixTitles(
      optionsPage,
      "PrettyStringifyOptions"
    );
    expectAutoImportFrom(titles, "./types");
  });

  test("unexported types pane is not visible in another userscript", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildPrettyStringify();
    const logger = buildLogger();

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify, logger],
      logger
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue("Logger | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(optionsPage, "createLogger");
    await expectCannotFindName(optionsPage, "PrettyStringifyOptions");
  });

  test("export type is importable from another userscript", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const prettyStringify = buildPrettyStringify(prettyStringifyExportedTypes);
    const logger = buildLogger({
      typeDefinitions: "",
      typescript: loggerImportedTypesSource,
    });

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify, logger],
      logger
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue("Logger | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(optionsPage, "PrettyStringifyOptions");
    await waitForTypescriptEditorText(optionsPage, "pretty-stringify");
    await expectNoEditorProblems(optionsPage);
  });

  test("adding export to an offscreen types pane enables auto-import", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    test.setTimeout(90_000);
    const prettyStringify = buildPrettyStringify();
    const logger = buildLogger({
      typeDefinitions: "",
      typescript: loggerUnresolvedTypeSource,
    });

    await seedScripts(
      optionsPage,
      clearStorage,
      seedStorage,
      [prettyStringify, logger],
      logger
    );

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await options.waitForEditorReady();
    await expect(scripts.scriptNameInput).toHaveValue("Logger | Utility", {
      timeout: 15_000,
    });
    await waitForTypescriptEditorText(optionsPage, "PrettyStringifyOptions");
    await expectCannotFindName(optionsPage, "PrettyStringifyOptions");

    await scripts.selectScript("Pretty Stringify | Utility", "prettyStringify");

    const exportedTypesOneLiner =
      "export type PrettyStringifyOptions = { quoteStrings?: boolean };";

    const typesEditor = optionsPage
      .locator("[data-testid='typescript-definitions'] .monaco-editor")
      .first();
    await replaceMonacoEditorContent(typesEditor, exportedTypesOneLiner);
    await waitForTypeDefinitionsEditorText(
      optionsPage,
      "export type PrettyStringifyOptions"
    );
    // Draft sync is debounced (~50ms); wait for Redux before the script-switch
    // sync reads typeDefinitions to decide whether to mount the offscreen pane.
    await optionsPage.waitForTimeout(300);

    await scripts.selectScript("Logger | Utility", "PrettyStringifyOptions");

    await expect
      .poll(
        async () => {
          const titles = await listQuickFixTitles(
            optionsPage,
            "PrettyStringifyOptions",
            8_000
          );
          await optionsPage.keyboard.press("Escape");
          return titles.some(
            (title) =>
              title.includes(
                'Add import from "scripts/pretty-stringify/types"'
              ) ||
              title.includes("Add import from 'scripts/pretty-stringify/types'")
          );
        },
        { timeout: 25_000 }
      )
      .toBe(true);
  });
});
