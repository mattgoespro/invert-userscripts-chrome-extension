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
    }));
    const scrollbarTheme = await content.evaluate(borderColor);
    expect(scrollbar.width).toBe("6px");
    expect(scrollbar.thumb).toBe(scrollbarTheme);
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
    // Matte Grey is the default and leaves data-theme unset.
    const nextTheme =
      (await settings.getDocumentTheme()) === null ? "Graphite" : "Obsidian";
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
    ).toBe(await content.evaluate(borderColor));
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

    await settings.setAppTheme("Graphite");

    await expect.poll(() => settings.getDocumentTheme()).toBe("graphite");
  });

  test("app theme defaults to matte grey (no data-theme attribute)", async ({
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

    // Matte Grey is the default theme and lives on :root without data-theme.
    const theme = await settings.getDocumentTheme();
    expect(theme).toBeNull();
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

  test("changing the editor theme keeps the scroll position and the section nav follows scrolling", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.setViewportSize({ width: 1280, height: 700 });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("settings");
    const settings = new SettingsPage(optionsPage);
    await settings.waitForReady();

    const content = optionsPage.getByRole("region", {
      name: "Settings content",
    });
    const nav = optionsPage.getByRole("navigation", {
      name: "Settings sections",
    });
    await expect(
      nav.getByRole("button", { name: "Appearance" })
    ).toHaveAttribute("aria-current", "true");

    const themeSelect = optionsPage.getByRole("button", {
      name: "Match app theme",
    });
    await themeSelect.scrollIntoViewIfNeeded();
    await themeSelect.click();
    await optionsPage
      .getByRole("button", { name: "GitHub Dark", exact: true })
      .click();
    // Measure after the click: Playwright scrolls the option into view first.
    const before = await content.evaluate((element) => element.scrollTop);
    expect(before).toBeGreaterThan(0);
    // A settings reload after the write used to remount the page at the top.
    await expect
      .poll(() =>
        optionsPage.evaluate(
          async () =>
            (await chrome.storage.sync.get("editorSettings")).editorSettings
              ?.theme
        )
      )
      .toBe("github-dark");
    await optionsPage.waitForTimeout(500);
    expect(await content.evaluate((element) => element.scrollTop)).toBe(before);

    await content.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      nav.getByRole("button", { name: "Build output" })
    ).toHaveAttribute("aria-current", "true");
    await content.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(
      nav.getByRole("button", { name: "Appearance" })
    ).toHaveAttribute("aria-current", "true");
  });

  test("clicking a section in the nav scrolls to it and highlights that label", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.setViewportSize({ width: 1440, height: 860 });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    await options.waitForReady();
    await options.clickTab("settings");
    const settings = new SettingsPage(optionsPage);
    await settings.waitForReady();

    const content = optionsPage.getByRole("region", {
      name: "Settings content",
    });
    const nav = optionsPage.getByRole("navigation", {
      name: "Settings sections",
    });
    const sectionTop = (id: string) =>
      content.evaluate(
        (element, anchor) =>
          Math.round(
            document.getElementById(anchor)!.getBoundingClientRect().top -
              element.getBoundingClientRect().top
          ),
        id
      );

    // Short sections near the end used to hand the highlight to a later one.
    for (const [label, anchor] of [
      ["Editing", "settings-editing"],
      ["Build output", "settings-build"],
      ["Advanced", "advanced-settings"],
      ["Editing", "settings-editing"],
      ["Appearance", "settings-appearance"],
    ] as const) {
      await nav.getByRole("button", { name: label, exact: true }).click();
      await expect(
        nav.getByRole("button", { name: label, exact: true })
      ).toHaveAttribute("aria-current", "true");
      await optionsPage.waitForTimeout(900);
      await expect(
        nav.getByRole("button", { name: label, exact: true })
      ).toHaveAttribute("aria-current", "true");
      const scrollable = await content.evaluate(
        (element) => element.scrollHeight - element.clientHeight
      );
      const scrollTop = await content.evaluate((element) => element.scrollTop);
      // The section reaches the top, unless the content has run out of room.
      if (scrollTop < scrollable - 1) {
        expect(Math.abs(await sectionTop(anchor))).toBeLessThanOrEqual(1);
      }
    }
  });
});

/** The computed color of the theme's --border token, resolved in the page. */
function borderColor(element: Element): string {
  const probe = element.ownerDocument.createElement("div");
  probe.style.backgroundColor = "var(--border)";
  element.ownerDocument.body.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

/** Inline helper for the reload test above. */
async function settings_getTheme(
  page: import("@playwright/test").Page
): Promise<string | null> {
  return page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
}

test("number settings accept values typed through out-of-range text", async ({
  optionsPage,
}) => {
  const options = new OptionsPage(optionsPage);
  await options.clickTab("settings");
  await new SettingsPage(optionsPage).waitForReady();
  const input = optionsPage
    .locator("label")
    .filter({ hasText: /^Font size$/ })
    .locator("..")
    .getByRole("spinbutton");

  await input.fill("");
  await expect(input).toHaveValue("");
  await input.pressSequentially("2");
  await expect(input).toHaveValue("2");
  await input.pressSequentially("0");
  await expect(input).toHaveValue("20");

  await input.fill("99");
  await expect(input).toHaveValue("99");
  await input.press("Tab");
  await expect(input).toHaveValue("20");
});

test("the status bar's Drive item opens the Advanced settings", async ({
  optionsPage,
}) => {
  await optionsPage.setViewportSize({ width: 1100, height: 600 });
  const options = new OptionsPage(optionsPage);
  await options.clickTab("scripts");
  await optionsPage.getByTitle("Show Drive sync details").click();
  await new SettingsPage(optionsPage).waitForReady();

  await expect(
    optionsPage.getByRole("button", { name: "Advanced", exact: true })
  ).toHaveAttribute("aria-expanded", "true");
  await expect(optionsPage.getByTestId("drive-sync-panel")).toBeInViewport();
});
