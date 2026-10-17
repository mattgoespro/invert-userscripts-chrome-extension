import { test, expect, buildUserscript } from "../fixtures";
import { buildCompiledLocalEntry } from "../helpers/injection";
import { minifyUserscript } from "../../packages/renderer/src/sandbox/minifier";
test("minified async nested dependencies finish before consumers and failed dependencies stay isolated", async ({
  optionsPage,
  extensionContext,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  // Keep the IDE compiler out of a runtime-only navigation fixture.
  await optionsPage.goto(
    optionsPage.url().replace("options.html", "popup.html")
  );
  const script = (id: string, source: string, shared = false) =>
    buildUserscript({
      id,
      name: id,
      moduleName: shared ? id : "",
      shared,
      enabled: !shared,
      urlPatterns: ["https://ordered.invert.test/*"],
      code: {
        source: { typescript: source, scss: "" },
        compiled: { javascript: "", css: "" },
      },
    });
  const inner = script(
    "inner",
    "await new Promise(resolve=>setTimeout(resolve,40)); export const value=1;",
    true
  );
  const outer = script(
    "outer",
    'import {value} from "scripts/inner/main"; export const doubled=value*2;',
    true
  );
  const consumer = script(
    "consumer",
    'import {doubled} from "scripts/outer/main"; document.documentElement.dataset.ordered=String(doubled);'
  );
  const broken = script(
    "broken",
    'throw new Error("dependency failed"); export const value=0;',
    true
  );
  const blocked = script(
    "blocked",
    'import {value} from "scripts/broken/main"; document.documentElement.dataset.blocked=String(value);'
  );
  const independent = script(
    "independent",
    'document.documentElement.dataset.independent="ran";'
  );
  const entries = [
    [
      inner,
      "(async function(){await new Promise(resolve=>setTimeout(resolve,40));window.__INVERT_SHARED__=window.__INVERT_SHARED__||{};window.__INVERT_SHARED__.inner={value:1};})();",
    ],
    [
      outer,
      "(function(){window.__INVERT_SHARED__.outer={doubled:window.__INVERT_SHARED__.inner.value*2};})();",
    ],
    [
      consumer,
      "document.documentElement.dataset.ordered=String(window.__INVERT_SHARED__.outer.doubled);",
    ],
    [broken, 'throw new Error("dependency failed");'],
    [blocked, 'document.documentElement.dataset.blocked="incorrect";'],
    [independent, 'document.documentElement.dataset.independent="ran";'],
  ] as const;
  const local: Record<string, unknown> = {};
  for (const [source, code] of entries) {
    const entry = buildCompiledLocalEntry(source, {
      javascript: await minifyUserscript(code),
      css: "",
    })["compiled:" + source.id];
    entry.build!.minifyCompiledOutput = true;
    local["compiled:" + source.id] = entry;
  }
  await seedStorage(
    optionsPage,
    {
      ...Object.fromEntries(
        entries.map(([source]) => ["userscript:" + source.id, source])
      ),
      editorSettings: { minifyCompiledOutput: true },
    },
    local
  );
  await extensionContext.route("https://ordered.invert.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: route.request().url().endsWith("/frame")
        ? "<html><body>Frame</body></html>"
        : '<html><body>Top<iframe src="/frame"></iframe></body></html>',
    })
  );
  const page = await extensionContext.newPage();
  await page.goto("https://ordered.invert.test/");
  await expect(page.locator("html")).toHaveAttribute("data-ordered", "2");
  await expect(page.locator("html")).toHaveAttribute("data-independent", "ran");
  expect(await page.getAttribute("html", "data-blocked")).toBeNull();
  expect(
    await page
      .frames()
      .find((frame) => frame.url().endsWith("/frame"))!
      .locator("html")
      .getAttribute("data-ordered")
  ).toBeNull();
  await page.close();
});
