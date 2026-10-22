import { test, expect } from "../fixtures";
import { OptionsPage } from "../page-objects";

test("permission notice overlays the whole IDE, supports editing, and closes when permission is granted", async ({
  optionsPage,
  extensionContext,
  extensionId,
}, testInfo) => {
  test.setTimeout(60_000);
  const details = await extensionContext.newPage();
  await details.goto("chrome://extensions/?id=" + extensionId);
  const toggle = details.getByRole("button", { name: /^Allow User Scripts/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  try {
    await optionsPage.bringToFront();
    const overlay = optionsPage.getByRole("dialog", {
      name: "Enable User Scripts",
      exact: true,
    });
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    expect(await overlay.evaluate((node) => node.matches(":modal"))).toBe(true);
    await expect(overlay).not.toHaveCSS("box-shadow", "none");
    const open = overlay.getByRole("button", {
      name: "Open extension details",
      exact: true,
    });
    await expect(open).toHaveCSS("height", "28px");
    await expect(open).toHaveCSS("font-size", "11px");
    await open.focus();
    await optionsPage.getByTitle("Settings", { exact: true }).focus();
    await expect(open).toBeFocused();
    for (let count = 0; count < 5; count++) {
      await optionsPage.keyboard.press("Tab");
      expect(
        // Native dialogs can yield focus to browser chrome (reported as body),
        // but must never let Tab focus controls in the underlying options UI.
        await overlay.evaluate(
          (node) =>
            document.activeElement === document.body ||
            node.contains(document.activeElement)
        )
      ).toBe(true);
    }
    await optionsPage.screenshot({
      path: testInfo.outputPath("user-scripts-overlay.png"),
    });
    await optionsPage.setViewportSize({ width: 375, height: 740 });
    const bounds = await overlay.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(359);
    await overlay
      .getByRole("button", { name: "Continue editing", exact: true })
      .click();
    await expect(overlay).toBeHidden();
    await new OptionsPage(optionsPage).clickTab("settings");
    await expect(
      optionsPage.getByRole("heading", { name: /Editor Appearance/ })
    ).toBeVisible();

    await optionsPage.reload();
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    const created = extensionContext.waitForEvent("page");
    await open.click();
    const opened = await created;
    await opened.waitForURL("chrome://extensions/?id=" + extensionId);
    await opened.getByRole("button", { name: /^Allow User Scripts/ }).click();
    await optionsPage.bringToFront();
    await expect(overlay).toBeHidden({ timeout: 10_000 });
    await opened.close();
  } finally {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }
    await details.close();
  }
});
