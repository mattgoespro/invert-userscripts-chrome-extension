import { test, expect, buildGlobalModule } from "../../fixtures";
import { OptionsPage, ModulesPage } from "../../pages";

test.describe("Global Modules", () => {
  test("adds a module and it appears in the list", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("modules");

    const modules = new ModulesPage(optionsPage);
    await modules.addModule("Moment.js", "https://cdn.jsdelivr.net/npm/moment@2.30.1/moment.min.js");

    await expect(optionsPage.getByText("Moment.js", { exact: true })).toBeVisible();
  });

  test("module persists after page reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({ name: "PersistModule", url: "https://cdn.jsdelivr.net/npm/lodash/lodash.min.js" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      globalModules: { [mod.id]: mod },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("modules");

    await expect(optionsPage.getByText("PersistModule", { exact: true })).toBeVisible();
  });

  test("deletes a module and it disappears from the list", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({ name: "DeleteModule", url: "https://example.com/script.js" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      globalModules: { [mod.id]: mod },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("modules");

    const modules = new ModulesPage(optionsPage);
    await modules.deleteModule("DeleteModule");

    await expect(optionsPage.getByText("DeleteModule", { exact: true })).toBeHidden();
  });

  test("toggling a module updates its enabled state", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({ name: "ToggleModule", url: "https://example.com/s.js", enabled: true });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      globalModules: { [mod.id]: mod },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("modules");

    const modules = new ModulesPage(optionsPage);
    await modules.toggleModule("ToggleModule");

    // After reload, the module should be disabled
    await optionsPage.reload();
    await options.waitForReady();
    await options.clickTab("modules");

    const card = optionsPage
      .locator("div")
      .filter({ has: optionsPage.getByText("ToggleModule", { exact: true }) })
      .first();
    const checkbox = card.locator("input[type='checkbox']");
    await expect(checkbox).not.toBeChecked();
  });
});
