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
