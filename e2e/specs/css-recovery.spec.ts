import { test, expect, buildUserscript } from "../fixtures";
import { buildCompiledLocalEntry } from "../helpers/injection";
test("a committed disable removes CSS after worker restart without a renderer effect message", async ({
  optionsPage,
  extensionContext,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await extensionContext.route("https://css-recovery.invert.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>CSS recovery</body></html>",
    })
  );
  const page = await extensionContext.newPage();
  await page.goto("https://css-recovery.invert.test/");
  const script = buildUserscript({
    id: "css-recovery",
    name: "CSS recovery",
    moduleName: "",
    shared: false,
    enabled: true,
    urlPatterns: ["https://css-recovery.invert.test/*"],
    code: {
      source: { typescript: "", scss: "html { opacity: 0.6; }" },
      compiled: { javascript: "", css: "" },
    },
  });
  const artifact = buildCompiledLocalEntry(script, {
    javascript: "",
    css: "html { opacity: 0.6; }",
  })["compiled:" + script.id];
  const first = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "css-on",
      writes: [
        {
          id: script.id,
          expectedRevision: null as string | null,
          script,
          artifact,
        },
      ],
    }
  );
  expect(first.status).toBe("committed");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).opacity)
    )
    .toBe("0.6");
  const worker = extensionContext.serviceWorkers()[0];
  await worker.evaluate(() => {
    chrome.scripting.removeCSS = (() => {
      (
        globalThis as typeof globalThis & { cssRemovalEntered?: boolean }
      ).cssRemovalEntered = true;
      return new Promise<void>(() => {});
    }) as typeof chrome.scripting.removeCSS;
  });
  const disabled = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "css-off",
      writes: [
        {
          id: script.id,
          expectedRevision: first.documents[0].revision,
          script: { ...script, enabled: false },
        },
      ],
    }
  );
  expect(disabled.status).toBe("committed");
  await expect
    .poll(() =>
      worker.evaluate(() =>
        Boolean(
          (globalThis as typeof globalThis & { cssRemovalEntered?: boolean })
            .cssRemovalEntered
        )
      )
    )
    .toBe(true);
  const session = await extensionContext.newCDPSession(optionsPage);
  const targets = await session.send("Target.getTargets");
  const target = targets.targetInfos.find(
    (target) =>
      target.type === "service_worker" && target.url.endsWith("background.js")
  );
  expect(target).toBeTruthy();
  await session.send("Target.closeTarget", { targetId: target!.targetId });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).opacity)
    )
    .toBe("1");
  await session.detach();
  await page.close();
});
