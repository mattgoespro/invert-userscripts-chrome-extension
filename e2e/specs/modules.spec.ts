import { test, expect, buildGlobalModule } from "../fixtures";
import { OptionsPage, ModulesPage } from "../page-objects";

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
    await modules.addModule(
      "Moment.js",
      "https://cdn.jsdelivr.net/npm/moment@2.30.1/moment.min.js"
    );

    await expect(
      optionsPage.getByText("Moment.js", { exact: true })
    ).toBeVisible();
  });

  test("module persists after page reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({
      name: "PersistModule",
      url: "https://cdn.jsdelivr.net/npm/lodash/lodash.min.js",
    });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      globalModules: { [mod.id]: mod },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("modules");

    await expect(
      optionsPage.getByText("PersistModule", { exact: true })
    ).toBeVisible();
  });

  test("deletes a module and it disappears from the list", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({
      name: "DeleteModule",
      url: "https://example.com/script.js",
    });
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

    await expect(
      optionsPage.getByText("DeleteModule", { exact: true })
    ).toBeHidden();
  });

  test("toggling a module updates its enabled state", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const mod = buildGlobalModule({
      name: "ToggleModule",
      url: "https://example.com/s.js",
      enabled: true,
    });
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

test("cancelling during URL validation doesn't add the module", async ({
  optionsPage,
  extensionContext,
  clearStorage,
}) => {
  let release = (): void => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached = (): void => {};
  const requested = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await extensionContext.route(
    "https://slow-cdn.invert.test/**",
    async (route) => {
      reached();
      await released;
      await route.fulfill({ status: 200, body: "" });
    }
  );
  await clearStorage(optionsPage);
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  await options.waitForReady();
  await options.clickTab("modules");

  const modules = new ModulesPage(optionsPage);
  await modules.openAddModuleDialog();
  await optionsPage.getByPlaceholder("e.g. Moment.js").fill("Abandoned");
  await optionsPage
    .getByPlaceholder(/cdnjs|jsdelivr/i)
    .fill("https://slow-cdn.invert.test/lib.js");
  const dialog = optionsPage.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Add Module$/i }).click();
  await requested;
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  release();
  await optionsPage.waitForTimeout(500);
  await expect(modules.moduleRow("Abandoned")).toHaveCount(0);
});

test("only a press that starts on the backdrop dismisses a dialog", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  await options.waitForReady();
  await options.clickTab("modules");
  await new ModulesPage(optionsPage).openAddModuleDialog();

  const dialog = optionsPage.getByRole("dialog");
  const box = await dialog.boundingBox();
  if (!box) {
    throw new Error("Dialog is not visible");
  }
  await optionsPage.mouse.move(box.x + box.width / 2, box.y + 12);
  await optionsPage.mouse.down();
  await optionsPage.mouse.move(5, 5, { steps: 5 });
  await optionsPage.mouse.up();
  await expect(dialog).toBeVisible();

  await optionsPage.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});
