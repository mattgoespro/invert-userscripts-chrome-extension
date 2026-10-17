import { readFile } from "node:fs/promises";
import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";

test("activated recovery export restores current source through the legacy-compatible importer", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const script = buildUserscript({
    name: "Recovery rehearsal",
    moduleName: "recover",
    shared: true,
    enabled: false,
    code: {
      source: {
        typescript: "export const original = 1;",
        scss: "body { color: red; }",
      },
      compiled: { javascript: "", css: "" },
    },
    typeDefinitions: "export type Saved = number;",
  });
  await seedStorage(optionsPage, { ["userscript:" + script.id]: script });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  const before = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "new-source-before-export",
      writes: [
        {
          id: script.id,
          expectedRevision: before.documents[0].revision,
          script: {
            ...script,
            code: {
              ...script.code,
              source: {
                ...script.code.source,
                typescript: "export const current = 2;",
              },
            },
          },
        },
      ],
    }
  );
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  await optionsPage.getByTitle("Settings", { exact: true }).click();
  const downloadEvent = optionsPage.waitForEvent("download");
  await optionsPage
    .getByRole("button", { name: "Download local recovery snapshot" })
    .click();
  const download = await downloadEvent;
  const file = await download.path();
  expect(file).toBeTruthy();
  const saved = JSON.parse(await readFile(file!, "utf8"));
  expect(saved.userscripts[0].sources.typescript).toBe(
    "export const current = 2;"
  );
  expect(saved.snapshot.documents[0].script.code.source.scss).toBe(
    script.code.source.scss
  );
  await clearStorage(optionsPage);
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  const scripts = new ScriptsPage(optionsPage);
  await new OptionsPage(optionsPage).clickTab("scripts");
  await scripts.openImportDialog();
  const chooser = optionsPage.waitForEvent("filechooser");
  await optionsPage
    .getByRole("textbox", { name: "Select userscripts file" })
    .click();
  await (await chooser).setFiles(file!);
  const importButton = optionsPage.getByRole("button", { name: /^Import$/i });
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await optionsPage.locator('[role="dialog"]').waitFor({ state: "hidden" });
  await scripts.selectScript(script.name, "current = 2");
  expect(await scripts.getTypescriptEditorText()).toContain("current = 2");
});
