import { test, expect, buildUserscript } from "../fixtures";
import {
  buildCompiledLocalEntry,
  sendApplyScripts,
} from "../helpers/injection";
test("userScripts executes MAIN-world code under enforced CSP while page inline code is blocked", async ({
  optionsPage,
  extensionContext,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const code =
    'document.documentElement.setAttribute("data-user-script","ran");';
  const script = buildUserscript({
    name: "CSP test",
    enabled: true,
    shared: false,
    moduleName: "",
    urlPatterns: ["https://csp.invert.test/*"],
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
  await optionsPage.reload();
  await extensionContext.route("https://csp.invert.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: {
        "Content-Security-Policy":
          "default-src 'none'; script-src 'none'; style-src 'none'",
      },
      body: '<!doctype html><html><body><script>document.documentElement.setAttribute("data-inline","ran")</script>CSP fixture</body></html>',
    })
  );
  const page = await extensionContext.newPage();
  await page.goto("https://csp.invert.test/");
  expect(await page.getAttribute("html", "data-inline")).toBeNull();
  await sendApplyScripts(optionsPage, [script.id]);
  await expect(page.locator("html")).toHaveAttribute("data-user-script", "ran");
  await page.close();
});
test("revoking Allow User Scripts rejects the real browser API while the IDE stays usable", async ({
  optionsPage,
  extensionContext,
  extensionId,
}) => {
  const details = await extensionContext.newPage();
  await details.goto("chrome://extensions/?id=" + extensionId);
  const toggle = details.getByRole("button", { name: /^Allow User Scripts/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  const allowed = await optionsPage.evaluate(async () => {
    try {
      await chrome.userScripts.getScripts();
      return true;
    } catch {
      return false;
    }
  });
  expect(allowed).toBe(false);
  await optionsPage.bringToFront();
  await expect(
    optionsPage.getByText("To run your scripts, enable Allow User Scripts", {
      exact: false,
    })
  ).toBeVisible({ timeout: 10000 });
  await toggle.click();
  await details.close();
});
