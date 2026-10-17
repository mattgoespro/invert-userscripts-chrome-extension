import { test, expect, buildUserscript } from "../fixtures";
import { buildCompiledLocalEntry } from "../helpers/injection";

test("internal pages silently skip injection, show an inactive badge, and restore on a normal page", async ({
  optionsPage,
  extensionContext,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  // Isolate runtime navigation from the IDE's automatic artifact rebuilds.
  await optionsPage.goto(
    optionsPage.url().replace("options.html", "popup.html")
  );
  const code = 'document.documentElement.dataset.invertRestrictedTest="ran";';
  const script = buildUserscript({
    enabled: true,
    shared: false,
    moduleName: "",
    urlPatterns: ["*"],
    code: {
      source: { typescript: code, scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
  await seedStorage(
    optionsPage,
    { ["userscript:" + script.id]: script },
    buildCompiledLocalEntry(script, { javascript: code, css: "" })
  );
  const errors: string[] = [];
  const onConsole = (message: { text: () => string }) => {
    if (
      /Error injecting scripts|Error applying scripts|Injection failed:/.test(
        message.text()
      )
    ) {
      errors.push(message.text());
    }
  };
  extensionContext.on("console", onConsole);
  const page = await extensionContext.newPage();
  const badge = () =>
    optionsPage.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const details = { tabId: tab.id! };
      return {
        text: await chrome.action.getBadgeText(details),
        color: await chrome.action.getBadgeBackgroundColor(details),
        title: await chrome.action.getTitle(details),
      };
    });
  try {
    await page.goto("chrome://settings/");
    await expect
      .poll(badge)
      .toEqual({
        text: "–",
        color: [107, 114, 128, 255],
        title: "Invert IDE — Scripts cannot run on this page",
      });
    const applied = await optionsPage.evaluate(
      (id) =>
        chrome.runtime.sendMessage({
          source: "options",
          type: "applyScripts",
          data: { scriptIds: [id] },
        }),
      script.id
    );
    expect(applied.success).toBe(true);
    expect(applied.appliedTabCount).toBe(0);
    await optionsPage.reload();
    await expect(
      optionsPage.getByText("Scripts cannot run on this page", { exact: true })
    ).toBeVisible();
    await expect(optionsPage.getByTitle("Open IDE")).toBeVisible();
    await extensionContext.route("https://eligible.invert.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body>Eligible</body></html>",
      })
    );
    await page.goto("https://eligible.invert.test/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-invert-restricted-test",
      "ran"
    );
    await expect
      .poll(badge)
      .toEqual({
        text: "1",
        color: [251, 191, 36, 255],
        title: "Invert IDE Userscripts",
      });
    await page.goto("chrome://extensions/");
    await expect
      .poll(badge)
      .toEqual({
        text: "–",
        color: [107, 114, 128, 255],
        title: "Invert IDE — Scripts cannot run on this page",
      });
    expect(errors).toEqual([]);
  } finally {
    extensionContext.off("console", onConsole);
    await page.close();
  }
});
