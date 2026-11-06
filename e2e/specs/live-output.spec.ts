import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { replaceMonacoEditorContent } from "../helpers/monaco";

test("live CSS retains unsaved source across metadata updates and script selection", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({
    name: "LiveCss",
    moduleName: "live-css",
    code: {
      source: { typescript: "export {};", scss: ".probe { color: green; }" },
      compiled: { javascript: "", css: "" },
    },
  });
  const other = buildUserscript({
    name: "OtherCss",
    moduleName: "other-css",
    code: {
      source: { typescript: "export {};", scss: ".other { color: blue; }" },
      compiled: { javascript: "", css: "" },
    },
  });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, {
    [`userscript:${script.id}`]: script,
    [`userscript:${other.id}`]: other,
  });
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage),
    scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript("LiveCss");
  const expand = optionsPage.getByTitle("Expand drawer");
  if (await expand.isVisible()) {
    await expand.click();
  }
  await scripts.clickDrawerTab("css");
  await replaceMonacoEditorContent(
    optionsPage.locator("#scss-editor .monaco-editor"),
    ".probe { color: red; }"
  );
  await expect.poll(() => scripts.getCompiledOutput()).toContain("red");
  await scripts.setScriptName("RenamedLiveCss");
  // Let storage refresh and the preview debounce settle after the rename.
  await optionsPage.waitForTimeout(800);
  await expect.poll(() => scripts.getCompiledOutput()).toContain("red");
  await scripts.selectScript("OtherCss");
  await expect.poll(() => scripts.getCompiledOutput()).toContain("blue");
  await scripts.selectScript("RenamedLiveCss");
  await expect.poll(() => scripts.getCompiledOutput()).toContain("red");
  await expect(optionsPage.locator("#scss-editor .view-lines")).toContainText(
    "red"
  );
});

test("live output shows a build failure instead of a blank tab", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({
    name: "BrokenCss",
    code: {
      source: { typescript: "export {};", scss: ".probe { color: green; }" },
      compiled: { javascript: "", css: "" },
    },
  });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage),
    scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript("BrokenCss");
  const expand = optionsPage.getByTitle("Expand drawer");
  if (await expand.isVisible()) {
    await expand.click();
  }
  await scripts.clickDrawerTab("css");
  await expect.poll(() => scripts.getCompiledOutput()).toContain("green");

  const source = optionsPage.locator("#scss-editor .monaco-editor");
  await replaceMonacoEditorContent(source, ".probe { color: ");
  const failure = optionsPage.getByText("This CSS couldn’t be built.");
  await expect(failure).toBeVisible({ timeout: 15_000 });
  await expect(
    optionsPage.getByRole("tab", { name: /^CSS\s+Failed$/ })
  ).toBeVisible();

  await replaceMonacoEditorContent(source, ".probe { color: red; }");
  await expect(failure).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => scripts.getCompiledOutput()).toContain("red");
});
