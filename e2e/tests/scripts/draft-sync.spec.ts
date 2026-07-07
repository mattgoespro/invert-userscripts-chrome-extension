import { test, expect, buildUserscript } from "../../fixtures";
import { buildUserscriptSyncManifest } from "../../fixtures/userscript-storage";
import { normalizeMonacoText } from "../../helpers/monaco";
import { OptionsPage, ScriptsPage } from "../../pages";

test.describe("Scripts — draft sync", () => {
  test("saved TypeScript survives hard reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "ReloadFidelity",
      code: {
        source: {
          typescript: "export const initial = 1;",
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("ReloadFidelity");
    await scripts.saveTypescriptCode(
      "export const saved = 42;",
      "ReloadFidelity"
    );

    await optionsPage.reload();
    await options.waitForReady();
    await scripts.selectScript("ReloadFidelity");

    const editorText = normalizeMonacoText(
      await optionsPage
        .locator("[data-testid='typescript-source'] .view-lines")
        .innerText()
    );

    expect(editorText).toContain("saved = 42");
  });

  test("metadata rename does not overwrite unsaved TypeScript in editor or storage", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "MetadataSafety",
      code: {
        source: {
          typescript: "export const stored = 1;",
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("MetadataSafety");

    const editor = optionsPage
      .locator("[data-testid='typescript-source'] .monaco-editor")
      .first();
    await editor.click();
    await optionsPage.keyboard.press("Control+a");
    await optionsPage.keyboard.type("export const unsaved = 99;");

    await scripts.setScriptName("RenamedMetadataSafety");

    const editorText = normalizeMonacoText(
      await optionsPage
        .locator("[data-testid='typescript-source'] .view-lines")
        .innerText()
    );
    expect(editorText).toContain("unsaved = 99");

    await optionsPage.reload();
    await options.waitForReady();
    await scripts.selectScript("RenamedMetadataSafety");

    const reloadedText = normalizeMonacoText(
      await optionsPage
        .locator("[data-testid='typescript-source'] .view-lines")
        .innerText()
    );
    expect(reloadedText).toContain("stored = 1");
    expect(reloadedText).not.toContain("unsaved = 99");
  });

  test("unsaved edits survive switching away and back", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const first = buildUserscript({
      name: "FirstScript",
      code: {
        source: { typescript: "export const first = 1;", scss: "" },
        compiled: { javascript: "", css: "" },
      },
    });
    const second = buildUserscript({
      name: "SecondScript",
      code: {
        source: { typescript: "export const second = 2;", scss: "" },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${first.id}`]: first,
      [`userscript:${second.id}`]: second,
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("FirstScript");

    const editor = optionsPage
      .locator("[data-testid='typescript-source'] .monaco-editor")
      .first();
    await editor.click();
    await optionsPage.keyboard.press("Control+a");
    await optionsPage.keyboard.type("export const switched = 7;");

    await scripts.selectScript("SecondScript");
    await scripts.selectScript("FirstScript");

    const editorText = normalizeMonacoText(
      await optionsPage
        .locator("[data-testid='typescript-source'] .view-lines")
        .innerText()
    );
    expect(editorText).toContain("switched = 7");
  });

  test("external storage change prompts conflict and take-remote applies remote text", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "ConflictScript",
      code: {
        source: {
          typescript: "export const local = 1;",
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("ConflictScript");

    const editor = optionsPage
      .locator("[data-testid='typescript-source'] .monaco-editor")
      .first();
    await editor.click();
    await optionsPage.keyboard.press("Control+a");
    await optionsPage.keyboard.type("export const dirty = 5;");

    await expect(
      scripts.scriptListPanel
        .locator("div")
        .filter({
          has: optionsPage.getByText("ConflictScript", { exact: true }),
        })
        .locator(".animate-pulse-indicator")
    ).toBeVisible({ timeout: 15_000 });

    const remoteScript = {
      ...script,
      code: {
        ...script.code,
        source: {
          ...script.code.source,
          typescript: "export const remote = 9;",
        },
      },
      updatedAt: Date.now(),
    };
    const remoteManifest = buildUserscriptSyncManifest(remoteScript);

    await optionsPage.evaluate(
      async ({ scriptId, manifest }) => {
        const allItems = await chrome.storage.sync.get(null);
        const modernKey = `userscript:${scriptId}`;
        const chunkKeys = Object.keys(allItems).filter((key) =>
          key.startsWith(`${modernKey}:chunk:`)
        );

        await chrome.storage.sync.remove([modernKey, ...chunkKeys]);
        await chrome.storage.sync.set({ [modernKey]: manifest });
      },
      { scriptId: script.id, manifest: remoteManifest }
    );

    await expect(
      optionsPage.getByRole("dialog", { name: "Storage sync conflict" })
    ).toBeVisible({ timeout: 15_000 });

    await optionsPage.getByRole("button", { name: "Take remote" }).click();

    await expect(
      optionsPage.getByRole("dialog", { name: "Storage sync conflict" })
    ).not.toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () =>
        normalizeMonacoText(
          await optionsPage
            .locator("[data-testid='typescript-source'] .view-lines")
            .innerText()
        )
      )
      .toContain("remote = 9");
  });
});
