import { test, expect, buildUserscript } from "../fixtures";
import { installReduxAudit, readReduxActions } from "../helpers/redux-audit";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
} from "../../packages/shared/src/compile-metadata";
import { analyzeModule } from "../../packages/renderer/src/sandbox/module-analysis";

test("clean startup skips redundant updates and bulk-checks cached scripts", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const scripts = Array.from({ length: 11 }, (_, index) =>
    buildUserscript({
      name: `Startup ${index}`,
      moduleName: `startup${index}`,
      enabled: false,
    })
  );
  await clearStorage(optionsPage);
  await seedStorage(
    optionsPage,
    Object.fromEntries(
      scripts.map((script) => [`userscript:${script.id}`, script])
    ),
    Object.fromEntries(
      scripts.map((script) => [
        `compiled:${script.id}`,
        {
          ...buildCompiledCodeEntry("", "", {
            minifyCompiledOutput: false,
            sourceHash: hashUserscriptCompileSources(script),
            compilerContractVersion: 2,
          }),
          manifest: analyzeModule(script.code.source.typescript),
        },
      ])
    )
  );
  await installReduxAudit(optionsPage);
  await optionsPage.addInitScript(() => {
    const target = window as typeof window & { __fullSyncReads: number };
    target.__fullSyncReads = 0;
    const original = chrome.storage.sync.get.bind(chrome.storage.sync);
    chrome.storage.sync.get = ((keys: string | string[] | null) => {
      if (keys === null) {
        target.__fullSyncReads++;
      }
      return original(keys);
    }) as typeof chrome.storage.sync.get;
  });
  const loggerMessages: string[] = [];
  optionsPage.on("console", (message) => {
    if (
      message.type() === "startGroupCollapsed" &&
      message.text().includes("action")
    ) {
      loggerMessages.push(message.text());
    }
  });
  await optionsPage.reload();
  await expect(optionsPage.locator(".monaco-editor").first()).toBeVisible();
  // Allow initial diagnostics and debounced UI/workspace work to settle.
  await optionsPage.waitForTimeout(700);
  const actions = await readReduxActions(optionsPage);
  expect(
    actions.filter(
      (action) => action.type === "editorDrafts/syncDraftFromRemoteScript"
    )
  ).toHaveLength(0);
  expect(
    actions.filter((action) => action.type === "editorDrafts/ensureDraft")
  ).toHaveLength(1);
  expect(
    actions.filter((action) => action.type === "ui/updatePanelSizes")
  ).toHaveLength(0);
  expect(
    actions.filter((action) => action.type === "workspace/setScriptErrors")
  ).toHaveLength(0);
  expect(
    actions.filter(
      (action) => action.type === "userscripts/acceptRebuiltArtifact"
    )
  ).toHaveLength(0);
  expect(actions).toHaveLength(16);
  expect(
    await optionsPage.evaluate(
      () =>
        (window as typeof window & { __fullSyncReads: number }).__fullSyncReads
    )
  ).toBe(2);
  expect(loggerMessages).toHaveLength(0);
  for (const size of [
    { width: 1200, height: 900 },
    { width: 1000, height: 800 },
    { width: 1200, height: 900 },
  ]) {
    await optionsPage.setViewportSize(size);
    await optionsPage.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
  }
  expect(
    (await readReduxActions(optionsPage)).filter(
      (action) => action.type === "ui/updatePanelSizes"
    )
  ).toHaveLength(0);
});
