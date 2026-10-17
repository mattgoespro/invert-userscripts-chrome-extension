import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { saveMonacoEditor } from "../helpers/monaco";

test("activation drains a legacy save already admitted by the background", async ({
  optionsPage,
  extensionContext,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const script = buildUserscript({
    id: "cutover",
    name: "Cutover",
    moduleName: "cutover",
    shared: false,
    enabled: false,
  });
  await seedStorage(optionsPage, { ["userscript:" + script.id]: script });
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  const scripts = new ScriptsPage(optionsPage);
  await scripts.selectScript(script.name);
  const worker = extensionContext.serviceWorkers()[0];
  await worker.evaluate(() => {
    const target = globalThis as typeof globalThis & {
      releaseCutover?: () => void;
      cutoverEntered?: boolean;
    };
    const original = chrome.storage.sync.set.bind(chrome.storage.sync);
    chrome.storage.sync.set = (async (values) => {
      if (Object.keys(values).includes("userscript:cutover")) {
        target.cutoverEntered = true;
        await new Promise<void>((resolve) => {
          target.releaseCutover = resolve;
        });
      }
      return original(values);
    }) as typeof chrome.storage.sync.set;
  });
  await scripts.replaceTypescriptCode("const admitted = 7;");
  await saveMonacoEditor(optionsPage);
  await expect
    .poll(() =>
      worker.evaluate(() =>
        Boolean(
          (globalThis as typeof globalThis & { cutoverEntered?: boolean })
            .cutoverEntered
        )
      )
    )
    .toBe(true);
  const activating = optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  expect(
    (
      await optionsPage.evaluate(() =>
        chrome.storage.local.get("publicationBackend")
      )
    ).publicationBackend
  ).not.toBe("transactional");
  await worker.evaluate(() => {
    (
      globalThis as typeof globalThis & { releaseCutover?: () => void }
    ).releaseCutover?.();
  });
  expect((await activating).status).toBe("active");
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(snapshot.documents[0].script.code.source.typescript).toContain(
    "admitted = 7"
  );
});
