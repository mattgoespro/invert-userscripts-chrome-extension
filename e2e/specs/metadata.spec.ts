import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";

test.describe("Scripts — metadata", () => {
  test("URL pattern is saved and shown after reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({ name: "PatternScript" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("PatternScript");
    await scripts.addUrlPattern("https://example.com/*");

    await optionsPage.reload();
    await options.waitForReady();
    // Re-select the script after reload so the metadata panel is rendered
    await scripts.selectScript("PatternScript");

    // Script details lists the saved pattern
    await expect(await scripts.urlPatternList()).toContainText("example.com", {
      timeout: 10_000,
    });
  });

  test("seeding a script with URL patterns shows them immediately", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "PatternsPreseeded",
      urlPatterns: ["https://example.com/*", "https://github.com/*"],
    });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("PatternsPreseeded");

    // Script details lists each pattern
    const patterns = await scripts.urlPatternList();
    await expect(patterns).toContainText("https://example.com/*");
    await expect(patterns).toContainText("https://github.com/*");
  });

  test("script marked as shared shows module name field", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "SharedScript",
      shared: true,
      moduleName: "my-module",
    });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("SharedScript");
    await scripts.openOptionsPanel();

    const moduleNameInput = optionsPage.getByPlaceholder("module-name");
    await expect(moduleNameInput).toBeVisible();
    await expect(moduleNameInput).toHaveValue("my-module");
  });

  test("runAt can be changed in script options and persists", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({
      name: "RunAtScript",
      runAt: "beforePageLoad",
      enabled: true,
      urlPatterns: ["https://example.com/*"],
    });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.selectScript("RunAtScript");
    await expect(optionsPage.getByTestId("script-setup-banner")).toHaveCount(0);
    await scripts.openOptionsPanel();

    const runAtSelect = optionsPage.getByTestId("run-at-select");
    await expect(
      runAtSelect.getByRole("radio", { name: "Before page load" })
    ).toHaveAttribute("aria-checked", "true");
    await runAtSelect.getByRole("radio", { name: "After page load" }).click();

    await expect(
      runAtSelect.getByRole("radio", { name: "After page load" })
    ).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });

    await optionsPage.reload();
    await options.waitForReady();
    await scripts.selectScript("RunAtScript");
    await scripts.openOptionsPanel();
    await expect(
      optionsPage
        .getByTestId("run-at-select")
        .getByRole("radio", { name: "After page load" })
    ).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
  });

  test("new script defaults to matching all URLs and does not show the setup banner", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    await scripts.createScript();
    await expect(optionsPage.getByTestId("script-setup-banner")).toHaveCount(0);
    await expect(await scripts.urlPatternList()).toContainText("*://*/*");
  });
});

test("Tab stays inside the Script details drawer", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({ name: "TrapScript" });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  const scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript("TrapScript");
  await scripts.openOptionsPanel();

  const focusInDrawer = (): Promise<boolean> =>
    optionsPage.evaluate(
      () => !!document.activeElement?.closest('[aria-label="Script details"]')
    );
  await optionsPage.keyboard.press("Shift+Tab");
  expect(await focusInDrawer()).toBe(true);
  for (let press = 0; press < 25; press += 1) {
    await optionsPage.keyboard.press("Tab");
    expect(await focusInDrawer()).toBe(true);
  }
});

test("the script list switch toggles without selecting, and rows work by keyboard", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const first = buildUserscript({ name: "RowFirst", enabled: true });
  const second = buildUserscript({ name: "RowSecond", enabled: true });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, {
    [`userscript:${first.id}`]: first,
    [`userscript:${second.id}`]: second,
  });
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  const scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript("RowFirst");

  const selected = scripts.scriptListPanel.locator(".border-l-accent");
  await scripts.toggleScript("RowSecond");
  await expect(selected).toContainText("RowFirst");
  await expect(
    scripts.scriptListPanel.getByRole("checkbox", { name: "Enable RowSecond" })
  ).not.toBeChecked();

  const row = scripts.scriptListPanel.getByRole("button", {
    name: "RowSecond",
    exact: true,
  });
  await row.focus();
  await optionsPage.keyboard.press("Enter");
  await expect(selected).toContainText("RowSecond");
  await expect(scripts.scriptNameInput).toHaveValue("RowSecond");
});

test("the name field follows a rename made elsewhere", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({ name: "BeforeRename" });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  const scripts = new ScriptsPage(optionsPage);
  await options.waitForReady();
  await scripts.selectScript("BeforeRename");
  await expect(scripts.scriptNameInput).not.toBeFocused();

  await seedStorage(optionsPage, {
    [`userscript:${script.id}`]: { ...script, name: "AfterRename" },
  });
  await expect(scripts.scriptNameInput).toHaveValue("AfterRename", {
    timeout: 15_000,
  });
});
