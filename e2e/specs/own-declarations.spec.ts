import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import {
  expectNoEditorProblems,
  saveMonacoEditor,
  waitForTypeDefinitionsEditorText,
} from "../helpers/monaco";
import type { RepositorySnapshot } from "../../packages/shared/src/publication/contracts";
import { readStoredUserscripts } from "../helpers/chrome-sync";

const declarations = [
  "type T<V = number> = { value: V };",
  "interface Options { count: number }",
].join("\n");
const ownerSource = [
  "export function makeValue(value: T['value']): T { return { value }; }",
  'const generic: T<string> = { value: "own" };',
  "const options: Options = { count: 1 };",
  "void generic; void options;",
].join("\n");
const consumerSource = [
  'import type { T } from "scripts/owner/types";',
  'import { makeValue } from "scripts/owner/main";',
  "const typed: T = { value: 1 };",
  "const inferred: number = makeValue(1).value;",
  "void typed; void inferred;",
].join("\n");

for (const backend of ["legacy", "transactional"] as const) {
  for (const shared of [false, true]) {
    test(`${backend}, shared=${shared}: own declarations survive adding/removing export, save, reload and script switches`, async ({
      optionsPage,
      clearStorage,
      seedStorage,
    }) => {
      test.setTimeout(120_000);
      const owner = buildUserscript({
        name: "Owner",
        moduleName: "owner",
        shared,
        enabled: false,
        typeDefinitions: declarations,
        code: {
          source: { typescript: ownerSource, scss: "" },
          compiled: { javascript: "", css: "" },
        },
      });
      const other = buildUserscript({
        name: "Same name, different type",
        moduleName: "other",
        enabled: false,
        typeDefinitions: "export interface T { value: string }",
        code: {
          source: {
            typescript: 'const own: T = { value: "other" }; void own;',
            scss: "",
          },
          compiled: { javascript: "", css: "" },
        },
      });
      const consumer = buildUserscript({
        name: "Consumer",
        moduleName: "consumer",
        enabled: false,
        typeDefinitions: "",
        code: {
          source: { typescript: consumerSource, scss: "" },
          compiled: { javascript: "", css: "" },
        },
      });
      await clearStorage(optionsPage);
      await seedStorage(optionsPage, {
        ...Object.fromEntries(
          [owner, other, consumer].map((script) => [
            "userscript:" + script.id,
            script,
          ])
        ),
        editorSettings: { autoFormat: true },
      });
      if (backend === "transactional") {
        const result = await optionsPage.evaluate(() =>
          chrome.runtime.sendMessage({ type: "publication.activate" })
        );
        expect(result.status).toBe("active");
      }
      await optionsPage.reload();
      const options = new OptionsPage(optionsPage);
      const scripts = new ScriptsPage(optionsPage);
      await options.waitForReady();
      await scripts.selectScript(owner.name, "makeValue");
      await expectNoEditorProblems(optionsPage);

      const typesEditor = optionsPage
        .locator("[data-testid='typescript-definitions'] .monaco-editor")
        .first();
      // Reproduce the reported gesture: add just the export keyword.
      await typesEditor.click();
      await optionsPage.keyboard.press("Control+Home");
      await optionsPage.keyboard.insertText("export ");
      await waitForTypeDefinitionsEditorText(optionsPage, "export type T");
      await expectNoEditorProblems(optionsPage);

      // The owner remains typed even while its editor is offscreen. Checking
      // inferred return types also prevents a fix that merely hides TS2304.
      await scripts.selectScript(consumer.name, "inferred");
      await expectNoEditorProblems(optionsPage);
      await scripts.replaceTypescriptCode(
        consumerSource.replace("inferred: number", "inferred: string")
      );
      const problems = optionsPage.locator("[data-testid='output-drawer']");
      await expect(problems).toContainText(
        "Type 'number' is not assignable to type 'string'"
      );
      await scripts.replaceTypescriptCode(consumerSource);
      await expect(problems).toContainText("No problems in this script");

      await scripts.selectScript(owner.name, "makeValue");
      await saveMonacoEditor(optionsPage, "typescript-definitions");
      const storedTypes = async (): Promise<string | undefined> => {
        if (backend === "legacy") {
          return (await readStoredUserscripts(optionsPage)).find(
            (script) => script.id === owner.id
          )?.typeDefinitions;
        }
        const snapshot: RepositorySnapshot = await optionsPage.evaluate(() =>
          chrome.runtime.sendMessage({ type: "publication.read" })
        );
        return snapshot.documents.find((item) => item.script.id === owner.id)
          ?.script.typeDefinitions;
      };
      const formatted =
        "export type T<V = number> = { value: V };\ninterface Options {\n  count: number;\n}\n";
      await expect.poll(storedTypes).toBe(formatted);
      const indicator = scripts.scriptListPanel
        .locator("div.group")
        .filter({ has: optionsPage.getByText(owner.name, { exact: true }) })
        .locator(".animate-pulse-indicator");
      await expect(indicator).toBeHidden();
      await optionsPage.reload();
      await options.waitForReady();
      await scripts.selectScript(owner.name, "makeValue");
      await expectNoEditorProblems(optionsPage);
      await scripts.selectScript(other.name, "own");
      await expectNoEditorProblems(optionsPage);
      await scripts.selectScript(owner.name, "makeValue");

      await typesEditor.click();
      await optionsPage.keyboard.press("Control+Home");
      for (let index = 0; index < "export ".length; index++) {
        await optionsPage.keyboard.press("Shift+ArrowRight");
      }
      await optionsPage.keyboard.press("Backspace");
      await waitForTypeDefinitionsEditorText(optionsPage, "type T");
      await expect(typesEditor.locator(".view-lines")).not.toContainText(
        "export type T"
      );
      await expectNoEditorProblems(optionsPage);
      await saveMonacoEditor(optionsPage, "typescript-definitions");
      await expect.poll(storedTypes).toBe(formatted.replace(/^export /, ""));
      await expect(indicator).toBeHidden();
      await optionsPage.reload();
      await options.waitForReady();
      await scripts.selectScript(owner.name, "makeValue");
      await expectNoEditorProblems(optionsPage);
      // An unrelated script still requires an import; owner bindings must not
      // become workspace globals when the declaration has an export keyword.
      await scripts.selectScript(consumer.name, "inferred");
      await scripts.replaceTypescriptCode(
        "const leaked: T = { value: 1 }; void leaked;"
      );
      await expect(problems).toContainText("Cannot find name 'T'");
    });
  }
}
