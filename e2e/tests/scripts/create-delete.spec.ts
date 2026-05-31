import { test, expect, buildUserscript } from "../../fixtures";
import { OptionsPage, ScriptsPage } from "../../pages";

test.describe("Scripts — create and delete", () => {
  test("creates a new script and shows it in the list", async ({ optionsPage, clearStorage }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.createScript();

    const names = await scripts.getScriptNames();
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  test("creates multiple scripts and each appears in the list", async ({ optionsPage, clearStorage }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.createScript();
    await scripts.createScript();
    await scripts.createScript();

    const names = await scripts.getScriptNames();
    expect(names.length).toBeGreaterThanOrEqual(3);
  });

  test("deletes the selected script and it is removed from the list", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({ name: "DeleteMe" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("DeleteMe");
    await scripts.deleteCurrentScript();

    // After deletion, the script should no longer appear in the list
    await expect(optionsPage.getByText("DeleteMe", { exact: true })).toBeHidden();
  });
});
