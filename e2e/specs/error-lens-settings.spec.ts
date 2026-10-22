import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { typescriptEditor } from "../helpers/monaco";

for (const backend of ["legacy", "transactional"] as const) {
  test(`${backend}: Error Lens radio setting persists and updates open editors`, async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }, testInfo) => {
    test.setTimeout(60_000);
    const script = buildUserscript({
      name: "Lens Setting",
      enabled: false,
      code: {
        source: {
          typescript: 'export const count: number = "wrong";',
          scss: "",
        },
        compiled: { javascript: "", css: "" },
      },
    });
    await clearStorage(optionsPage);
    // Older settings have no errorLens property and must retain today's default.
    await seedStorage(optionsPage, {
      [`userscript:${script.id}`]: script,
      editorSettings: { autoFormat: false },
    });
    if (backend === "transactional") {
      const activation = await optionsPage.evaluate(() =>
        chrome.runtime.sendMessage({ type: "publication.activate" })
      );
      expect(activation.status).toBe("active");
    }
    await optionsPage.reload();
    await new OptionsPage(optionsPage).clickTab("scripts");
    await new ScriptsPage(optionsPage).selectScript(
      script.name,
      "count: number"
    );
    const editor = typescriptEditor(optionsPage);
    const message = editor.locator(".error-lens-message");
    await expect(message.first()).toBeVisible({ timeout: 20_000 });

    const settingsPage = await optionsPage.context().newPage();
    try {
      await settingsPage.goto(optionsPage.url());
      const options = new OptionsPage(settingsPage);
      await options.waitForReady();
      await options.clickTab("settings");
      const group = settingsPage.getByRole("group", {
        name: "Error Lens",
        exact: true,
      });
      const on = group.getByRole("radio", { name: "On", exact: true });
      const off = group.getByRole("radio", { name: "Off", exact: true });
      await expect(on).toBeChecked();
      await on.focus();
      await on.press("ArrowRight");
      await expect(off).toBeChecked();

      const storedSetting = async (): Promise<boolean | undefined> =>
        settingsPage.evaluate(async (mode) => {
          if (mode === "transactional") {
            const snapshot = await chrome.runtime.sendMessage({
              type: "publication.read",
            });
            return snapshot.settings.errorLens;
          }
          return (await chrome.storage.sync.get("editorSettings"))
            .editorSettings?.errorLens;
        }, backend);
      await expect.poll(storedSetting).toBe(false);
      await group.screenshot({
        path: testInfo.outputPath("error-lens-control.png"),
      });

      await optionsPage.bringToFront();
      await expect(message).toHaveCount(0);
      await expect(editor.locator(".error-lens-line-error")).toHaveCount(0);
      // Disabling the lens must leave Monaco's diagnostics available.
      await expect(editor.locator(".squiggly-error").first()).toBeVisible();

      await settingsPage.reload();
      await options.waitForReady();
      await options.clickTab("settings");
      await expect(off).toBeChecked();
      await off.focus();
      await off.press("ArrowLeft");
      await expect(on).toBeChecked();
      await expect.poll(storedSetting).toBe(true);

      await optionsPage.bringToFront();
      await expect(message.first()).toBeVisible();
      await settingsPage.reload();
      await options.waitForReady();
      await options.clickTab("settings");
      await expect(on).toBeChecked();
    } finally {
      await settingsPage.close();
    }
  });
}
