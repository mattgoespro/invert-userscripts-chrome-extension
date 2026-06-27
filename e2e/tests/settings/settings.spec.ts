import { test, expect } from "../../fixtures";
import { OptionsPage, SettingsPage } from "../../pages";

test.describe("Settings", () => {
  test("changing the app theme updates the data-theme attribute", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("settings");

    const settings = new SettingsPage(optionsPage);
    await settings.waitForReady();

    await settings.setAppTheme("Obsidian");

    const theme = await settings.getDocumentTheme();
    expect(theme).toBe("obsidian");
  });

  test("app theme defaults to graphite (no data-theme attribute)", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("settings");

    const settings = new SettingsPage(optionsPage);
    await settings.waitForReady();

    // Default is graphite, which removes data-theme
    const theme = await settings.getDocumentTheme();
    // Either null/absent or "graphite" depending on seeded settings
    expect(theme === null || theme === "graphite").toBe(true);
  });

  test("app theme persists after page reload", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    await clearStorage(optionsPage);
    // Seed with obsidian-deep theme
    await seedStorage(optionsPage, {
      editorSettings: {
        appTheme: "obsidian-deep",
      },
    });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();

    // The theme should be applied even without visiting settings page
    const theme = await settings_getTheme(optionsPage);
    expect(theme).toBe("obsidian-deep");
  });

  test("minify toggle shows a toast notification", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("settings");

    const settings = new SettingsPage(optionsPage);
    await settings.waitForReady();

    await settings.toggleMinify();

    // Toast should appear after rebuild completes.
    // Exclude Monaco's aria-atomic=true live regions which also have role=alert.
    await expect(
      optionsPage.locator("[role='alert']:not([aria-atomic='true'])")
    ).toBeVisible({ timeout: 20_000 });
  });
});

/** Inline helper for the reload test above. */
async function settings_getTheme(
  page: import("@playwright/test").Page
): Promise<string | null> {
  return page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
}
