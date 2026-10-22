import { type Page } from "@playwright/test";
import { test, expect, buildUserscript } from "../fixtures";
import {
  expectCannotFindName,
  expectNoEditorProblems,
  listQuickFixTitles,
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

/** Exported declarations remain implicit in the owner and importable elsewhere. */
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

/**
 * Every types-pane declaration belongs to its own main editor. Export controls
 * imports from other scripts; it must never remove the owner's implicit types.
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

  test("own exported type resolves without adding an import", async ({
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
    await expectNoEditorProblems(optionsPage);
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
    await scripts.selectScript(prettyStringify.name, "prettyStringify");
    await expectNoEditorProblems(optionsPage);
  });

  test("adding export to an offscreen types pane enables auto-import", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    test.setTimeout(90_000);
    // Keep the declaration on the first line for a keyboard-only gesture;
    // Monaco virtualizes lines outside the declarations pane's viewport.
    const prettyStringify = buildPrettyStringify(
      ["type PrettyStringifyOptions = {", prettyStringifyTypeBody, "};"].join(
        "\n"
      )
    );
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

    const typesEditor = optionsPage
      .locator("[data-testid='typescript-definitions'] .monaco-editor")
      .first();
    await expectNoEditorProblems(optionsPage);
    await typesEditor.click();
    await optionsPage.keyboard.press("Control+Home");
    await optionsPage.keyboard.insertText("export ");
    // Monaco's wrapped glyph layout is not a source-text API. The dirty state,
    // clean owner and canonical auto-import below verify this unsaved edit.
    await expect(
      scripts.scriptListPanel.locator(
        ".border-l-accent .animate-pulse-indicator"
      )
    ).toBeVisible();
    await expectNoEditorProblems(optionsPage);

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
    await optionsPage.keyboard.press("Escape");
    await scripts.selectScript(prettyStringify.name, "prettyStringify");
    await expectNoEditorProblems(optionsPage);
  });

  for (const explicitImport of [false, true]) {
    test(`imported dependencies, exported interfaces and private peers resolve in a previously unopened owner (explicit import=${explicitImport})`, async ({
      optionsPage,
      clearStorage,
      seedStorage,
    }) => {
      const dependency = buildPrettyStringify(
        "export interface Base { label: string }"
      );
      dependency.code.source.typescript = "export const base = 1;";
      const owner = buildLogger({
        typeDefinitions: [
          'import type { Base } from "scripts/pretty-stringify/types";',
          "interface Private { count: number }",
          "export interface T extends Base, Private {}",
          "export type Generic<V = T> = { value: V };",
          "declare function createValue(): T;",
        ].join("\n"),
        typescript: [
          ...(explicitImport ? ['import type { T } from "./types";'] : []),
          'const own: T = { label: "owner", count: 1 };',
          "const wrapped: Generic = { value: own };",
          "const privateValue: Private = { count: 2 };",
          "const created: T = createValue();",
          "void wrapped; void privateValue; void created;",
        ].join("\n"),
      });
      await seedScripts(
        optionsPage,
        clearStorage,
        seedStorage,
        [dependency, owner],
        dependency
      );
      const options = new OptionsPage(optionsPage);
      const scripts = new ScriptsPage(optionsPage);
      await options.waitForReady();
      await scripts.selectScript(owner.name, "wrapped");
      await expectNoEditorProblems(optionsPage);
    });
  }
});
