import { test, expect, buildUserscript } from "../fixtures";
import { buildCompiledLocalEntry } from "../helpers/injection";
test("a restarted service worker returns the durable receipt without committing twice", async ({
  optionsPage,
  extensionContext,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  const command = {
    requestId: "restart-receipt",
    writes: [
      {
        id: "restart",
        expectedRevision: null as string | null,
        script: buildUserscript({
          id: "restart",
          enabled: false,
          moduleName: "restart",
        }),
      },
    ],
  };
  const first = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    command
  );
  expect(first.status).toBe("committed");
  const session = await extensionContext.newCDPSession(optionsPage);
  const targets = await session.send("Target.getTargets");
  const target = targets.targetInfos.find(
    (target) =>
      target.type === "service_worker" && target.url.includes("background.js")
  );
  expect(target).toBeTruthy();
  await session.send("Target.closeTarget", { targetId: target!.targetId });
  const retried = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    command
  );
  expect(retried.documents[0].revision).toBe(first.documents[0].revision);
  expect(retried.generation).toBe(first.generation);
  await session.detach();
});
test("a worker stopped during JavaScript reports unknown and never repeats the effect on retry", async ({
  optionsPage,
  extensionContext,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  const page = await extensionContext.newPage();
  await extensionContext.route("https://interrupted.invert.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Effect fixture</body></html>",
    })
  );
  await page.goto("https://interrupted.invert.test/");
  const code =
    '(async function(){document.documentElement.setAttribute("data-started",String(Number(document.documentElement.getAttribute("data-started")||0)+1));await new Promise(()=>{});})();';
  const script = buildUserscript({
    id: "effect",
    name: "Interrupted effect",
    enabled: true,
    shared: false,
    moduleName: "effect",
    urlPatterns: ["https://interrupted.invert.test/*"],
    code: {
      source: { typescript: code, scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
  const artifact = buildCompiledLocalEntry(script, {
    javascript: code,
    css: "",
  })["compiled:" + script.id];
  const committed = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "effect-source",
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
  expect(committed.status).toBe("committed");
  const message = {
    source: "options",
    type: "applyScripts",
    data: { scriptIds: [script.id], requestId: "interrupted-effect" },
  };
  await optionsPage.evaluate((message) => {
    void chrome.runtime.sendMessage(message).catch(() => {});
  }, message);
  await expect(page.locator("html")).toHaveAttribute("data-started", "1");
  const session = await extensionContext.newCDPSession(optionsPage);
  const targets = await session.send("Target.getTargets");
  const worker = targets.targetInfos.find(
    (target) =>
      target.type === "service_worker" && target.url.endsWith("background.js")
  );
  expect(worker).toBeTruthy();
  await session.send("Target.closeTarget", { targetId: worker!.targetId });
  const retried = await optionsPage.evaluate(
    (message) => chrome.runtime.sendMessage(message),
    message
  );
  expect(retried.status).toBe("unknown");
  expect(retried.success).toBe(false);
  expect(await page.getAttribute("html", "data-started")).toBe("1");
  await session.detach();
  await page.close();
});
