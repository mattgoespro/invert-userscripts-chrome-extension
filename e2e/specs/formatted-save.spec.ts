import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { readStoredUserscripts } from "../helpers/chrome-sync";
import {
  replaceMonacoEditorContent,
  saveMonacoEditor,
  typescriptEditor,
} from "../helpers/monaco";
import { installReduxAudit, readReduxActions } from "../helpers/redux-audit";
import type { RepositorySnapshot } from "../../packages/shared/src/publication/contracts";

for (const backend of ["legacy", "transactional"] as const) {
  for (const newline of ["LF", "CRLF"] as const) {
    test(`${backend}: format-on-save persists source and stays clean with ${newline} models`, async ({
      optionsPage,
      clearStorage,
      seedStorage,
    }, testInfo) => {
      await clearStorage(optionsPage);
      const eol = newline === "CRLF" ? "\r\n" : "\n";
      const script = buildUserscript({
        name: "Formatted save " + newline,
        enabled: false,
        code: {
          source: {
            typescript:
              "export const initial = 1;" +
              eol +
              "export const untouched = true;" +
              eol,
            scss: "",
          },
          compiled: { javascript: "", css: "" },
        },
      });
      await seedStorage(optionsPage, {
        ["userscript:" + script.id]: script,
        editorSettings: { autoFormat: true },
      });
      if (backend === "transactional") {
        const activation = await optionsPage.evaluate(() =>
          chrome.runtime.sendMessage({ type: "publication.activate" })
        );
        expect(activation.status).toBe("active");
      }
      await installReduxAudit(optionsPage);
      await optionsPage.reload();
      await new OptionsPage(optionsPage).waitForReady();
      const scripts = new ScriptsPage(optionsPage);
      await scripts.selectScript(script.name, "initial = 1");
      const indicator = scripts.scriptListPanel
        .locator("div.group")
        .filter({ has: optionsPage.getByText(script.name, { exact: true }) })
        .locator(".animate-pulse-indicator");
      const formatted =
        'export function answer() {\n  return { value: 42, label: "saved" };\n}\n';
      await replaceMonacoEditorContent(
        typescriptEditor(optionsPage),
        "export function answer(){return {value:42,label:'saved'}}"
      );
      await expect(indicator).toBeVisible();
      await saveMonacoEditor(optionsPage);
      const storedSource = async (): Promise<string | undefined> => {
        if (backend === "transactional") {
          const snapshot: RepositorySnapshot = await optionsPage.evaluate(() =>
            chrome.runtime.sendMessage({ type: "publication.read" })
          );
          return snapshot.documents.find((item) => item.script.id === script.id)
            ?.script.code.source.typescript;
        }
        return (await readStoredUserscripts(optionsPage)).find(
          (item) => item.id === script.id
        )?.typescript;
      };
      await expect.poll(storedSource).toBe(formatted);
      await expect
        .poll(async () =>
          (await readReduxActions(optionsPage)).some(
            (action) => action.type === "code-editor/saveEditorCode/fulfilled"
          )
        )
        .toBe(true);
      await testInfo.attach("save-actions", {
        body: JSON.stringify(await readReduxActions(optionsPage), null, 2),
        contentType: "application/json",
      });
      await expect(indicator).toBeHidden();
      // Saving the already-formatted buffer again must remain clean as well.
      await saveMonacoEditor(optionsPage);
      await expect
        .poll(
          async () =>
            (await readReduxActions(optionsPage)).filter(
              (action) => action.type === "code-editor/saveEditorCode/fulfilled"
            ).length
        )
        .toBe(2);
      await expect(indicator).toBeHidden();
      expect(await storedSource()).toBe(formatted);
      await optionsPage.reload();
      await new OptionsPage(optionsPage).waitForReady();
      await scripts.selectScript(script.name, "answer()");
      await expect(indicator).toBeHidden();
      expect(await storedSource()).toBe(formatted);
    });
  }
}
