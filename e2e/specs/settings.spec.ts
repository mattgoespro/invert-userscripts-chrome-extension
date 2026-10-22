import { test, expect } from "../fixtures";
import { OptionsPage, SettingsPage } from "../page-objects";

test.describe("Settings", () => {
  test("settings content scrolls to Drive controls while its header stays fixed", async ({
    optionsPage,
  }) => {
    await optionsPage.setViewportSize({ width: 1100, height: 600 });
    const options = new OptionsPage(optionsPage);
    await options.clickTab("settings");
    await new SettingsPage(optionsPage).waitForReady();
    const header = optionsPage.getByRole("heading", {
      name: "Settings",
      exact: true,
    });
    const before = await header.boundingBox();
    const advanced = optionsPage.getByRole("button", {
      name: "Advanced",
      exact: true,
    });
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await expect(optionsPage.getByTestId("drive-sync-panel")).toBeHidden();
    await expect(
      optionsPage.getByText("chrome.storage.sync", { exact: true })
    ).toBeHidden();
    await expect(optionsPage.getByTestId("drive-sync-banner")).toHaveCount(0);
    await advanced.focus();
    await optionsPage.keyboard.press("Enter");
    await expect(advanced).toHaveAttribute("aria-expanded", "true");
    const sections = optionsPage.locator("#advanced-settings > div > h3");
    await expect(sections).toHaveText([
      /Document storage and sync$/,
      /Storage Quota$/,
    ]);
    await expect(
      optionsPage.getByRole("button", {
        name: "Download local recovery snapshot",
      })
    ).toHaveCount(0);
    const content = optionsPage.getByRole("region", {
      name: "Settings content",
      exact: true,
    });
    await expect(content).toBeVisible();
    await expect
      .poll(() =>
        content.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true);
    await content.hover();
    await optionsPage.mouse.wheel(0, 4000);
    await expect
      .poll(() => content.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const drive = optionsPage.getByTestId("drive-sync-panel");
    await drive.scrollIntoViewIfNeeded();
    await expect(drive).toBeInViewport();
    await expect(
      optionsPage.getByRole("button", {
        name: /^(Connect|Disconnect)$/,
      })
    ).toBeInViewport();
    expect((await header.boundingBox()).y).toBeCloseTo(before.y, 1);
    expect(
      await optionsPage.evaluate(() => document.scrollingElement.scrollTop)
    ).toBe(0);
    await header.hover();
    await optionsPage.screenshot({
      path: "temp/settings-scroll-bottom.png",
    });
    const scrollbar = await content.evaluate((element) => ({
      width: getComputedStyle(element, "::-webkit-scrollbar").width,
      thumb: getComputedStyle(element, "::-webkit-scrollbar-thumb")
        .backgroundColor,
      theme: getComputedStyle(element.previousElementSibling).borderBottomColor,
    }));
    expect(scrollbar.width).toBe("6px");
    expect(scrollbar.thumb).toBe(scrollbar.theme);
    await content.focus();
    await optionsPage.keyboard.press("Home");
    await expect
      .poll(() => content.evaluate((element) => element.scrollTop))
      .toBe(0);
    await optionsPage.keyboard.press("PageDown");
    await expect
      .poll(() => content.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const settings = new SettingsPage(optionsPage);
    const nextTheme =
      (await settings.getDocumentTheme()) === "obsidian"
        ? "Graphite"
        : "Obsidian";
    await settings.setAppTheme(nextTheme);
    await header.hover();
    await expect
      .poll(() =>
        content.evaluate(
          (element) =>
            getComputedStyle(element, "::-webkit-scrollbar-thumb")
              .backgroundColor
        )
      )
      .not.toBe(scrollbar.thumb);
    expect(
      await content.evaluate(
        (element) =>
          getComputedStyle(element, "::-webkit-scrollbar-thumb").backgroundColor
      )
    ).toBe(
      await content.evaluate(
        (element) =>
          getComputedStyle(element.previousElementSibling).borderBottomColor
      )
    );
    await advanced.focus();
    await optionsPage.keyboard.press("Space");
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await expect(drive).toBeHidden();
  });

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

    await expect.poll(() => settings.getDocumentTheme()).toBe("obsidian");
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
