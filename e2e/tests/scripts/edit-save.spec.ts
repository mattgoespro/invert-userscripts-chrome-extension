import { test, expect, buildUserscript } from "../../fixtures";
import { OptionsPage, ScriptsPage } from "../../pages";

test.describe("Scripts — edit and save", () => {
  test("renamed script name persists after page reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({ name: "OriginalName" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("OriginalName");
    await scripts.setScriptName("RenamedScript");

    // Reload and verify persistence
    await optionsPage.reload();
    await options.waitForReady();

    const names = await scripts.getScriptNames();
    expect(names).toContain("RenamedScript");
    expect(names).not.toContain("OriginalName");
  });

  test("disabled script shows as disabled in the list", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({ name: "ToggleScript", enabled: true });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();

    // Toggle the script off
    await scripts.toggleScript("ToggleScript");

    // Reload and check the switch state reflects disabled
    await optionsPage.reload();
    await options.waitForReady();

    // The switch for the script should be unchecked (disabled)
    const item = scripts.scriptListPanel
      .locator("div")
      .filter({ has: optionsPage.getByText("ToggleScript", { exact: true }) });
    const checkbox = item.locator("input[type='checkbox']");
    await expect(checkbox).not.toBeChecked({ timeout: 15_000 });
  });
});
