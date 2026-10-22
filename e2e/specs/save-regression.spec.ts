import { readFileSync } from "node:fs";
import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { typescriptEditor } from "../helpers/monaco";
import { readStoredUserscripts } from "../helpers/chrome-sync";
import { format } from "prettier";
import type { RepositorySnapshot } from "../../packages/shared/src/publication/contracts";

const toasts = readFileSync(
  new URL("../../examples/userscripts/toasts.ts", import.meta.url),
  "utf8"
).replace(
  "function _getToastContainer() {",
  "function _getToastContainer( ){ "
);

for (const backend of ["legacy", "transactional"] as const) {
  for (const edited of [false, true]) {
    test(`${backend}: native Ctrl+S keeps ${edited ? "edited" : "clean"} CRLF toast source saved`, async ({
      optionsPage,
      clearStorage,
      seedStorage,
    }) => {
      const script = buildUserscript({
        name: "Toast save regression",
        moduleName: "toasts",
        enabled: false,
        shared: true,
        code: {
          source: { typescript: toasts.replace(/\r?\n/g, "\r\n"), scss: "" },
          compiled: { javascript: "", css: "" },
        },
      });
      await clearStorage(optionsPage);
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
      // Reproduce the production store without a DevTools enhancer injected.
      await optionsPage.reload();
      await new OptionsPage(optionsPage).waitForReady();
      const scripts = new ScriptsPage(optionsPage);
      await scripts.selectScript(script.name, "_getToastContainer");
      const editor = typescriptEditor(optionsPage);
      await editor.click();
      await optionsPage.keyboard.press("Control+Home");
      if (edited) {
        await optionsPage.keyboard.insertText("// changed\n");
      }
      await optionsPage.keyboard.press("Control+s");
      const expected = await format((edited ? "// changed\n" : "") + toasts, {
        parser: "typescript",
        printWidth: 100,
        trailingComma: "es5",
      });
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
      await expect.poll(storedSource).toBe(expected);
      // Check settled state as well as the first completed-save frame.
      await optionsPage.waitForTimeout(1500);
      const indicator = scripts.scriptListPanel.locator(
        ".border-l-accent .animate-pulse-indicator"
      );
      await expect(indicator).toBeHidden();
      // A second native save and a fresh page must retain the exact saved source.
      await optionsPage.keyboard.press("Control+s");
      await optionsPage.waitForTimeout(1500);
      await expect(indicator).toBeHidden();
      expect(await storedSource()).toBe(expected);
      await optionsPage.reload();
      await new OptionsPage(optionsPage).waitForReady();
      await scripts.selectScript(script.name, "_getToastContainer");
      await expect(indicator).toBeHidden();
      expect(await storedSource()).toBe(expected);
    });
  }
}
