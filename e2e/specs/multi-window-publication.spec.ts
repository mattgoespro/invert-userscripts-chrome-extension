import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import {
  waitForTypescriptEditorText,
  typescriptEditor,
} from "../helpers/monaco";

test("activated storage saves through the IDE and preserves a dirty session across another window's commit", async ({
  optionsPage,
  extensionContext,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const script = buildUserscript({
    name: "Two windows",
    shared: false,
    enabled: false,
    moduleName: "windows",
    code: {
      source: { typescript: "const original = 1;", scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
  await seedStorage(optionsPage, { ["userscript:" + script.id]: script });
  expect(
    (
      await optionsPage.evaluate(() =>
        chrome.runtime.sendMessage({ type: "publication.activate" })
      )
    ).status
  ).toBe("active");
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  const scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript(script.name);
  await scripts.saveTypescriptCode("const durable = 2;");
  await expect
    .poll(async () => {
      const state = await optionsPage.evaluate(() =>
        chrome.runtime.sendMessage({ type: "publication.read" })
      );
      return state.documents[0].script.code.source.typescript;
    })
    .toContain("durable = 2");
  await scripts.replaceTypescriptCode("const unfinished = 3;");
  const other = await extensionContext.newPage();
  await other.goto(optionsPage.url());
  const current = await other.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  const document = current.documents.find(
    (item: { script: { id: string } }) => item.script.id === script.id
  );
  const result = await other.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "other-window",
      writes: [
        {
          id: script.id,
          expectedRevision: document.revision,
          script: {
            ...document.script,
            code: {
              source: { typescript: "const peer = 4;", scss: "" },
              compiled: { javascript: "", css: "" },
            },
          },
        },
      ],
    }
  );
  expect(result.status).toBe("committed");
  await expect(
    optionsPage.getByRole("button", { name: "Keep local", exact: true })
  ).toBeVisible();
  await waitForTypescriptEditorText(optionsPage, "unfinished = 3");
  await other.close();
});

test("renaming an alias preserves the actual Monaco undo stack", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const script = buildUserscript({
    name: "Undo rename",
    moduleName: "before",
    shared: true,
    enabled: false,
    code: {
      source: { typescript: "const original = 1;", scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
  await seedStorage(optionsPage, { ["userscript:" + script.id]: script });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  const scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript(script.name);
  await typescriptEditor(optionsPage).click();
  await optionsPage.keyboard.press("Control+a");
  await optionsPage.keyboard.insertText("const changed = 2;");
  await waitForTypescriptEditorText(optionsPage, "changed = 2");
  await scripts.setModuleName("after");
  await scripts.closeOptionsPanel();
  await expect
    .poll(async () => {
      const snapshot = await optionsPage.evaluate(() =>
        chrome.runtime.sendMessage({ type: "publication.read" })
      );
      return snapshot.documents.find(
        (document: { script: { id: string } }) =>
          document.script.id === script.id
      )?.script.moduleName;
    })
    .toBe("after");
  await typescriptEditor(optionsPage).click();
  for (let step = 0; step < 10; step++) {
    await optionsPage.keyboard.press("Control+z");
    if ((await scripts.getTypescriptEditorText()).includes("original = 1")) {
      break;
    }
  }
  await waitForTypescriptEditorText(optionsPage, "original = 1");
});
