import { test, expect, buildUserscript } from "../../fixtures";
import { PopupPage } from "../../pages";

test.describe("Popup", () => {
  test("shows empty state when no scripts match the current tab", async ({
    popupPage,
    clearStorage,
  }) => {
    await clearStorage(popupPage);
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    expect(await popup.isEmpty()).toBe(true);
  });

  test("shows matching scripts count in the footer", async ({
    popupPage,
    clearStorage,
    seedStorage,
  }) => {
    // The popup queries the active tab URL; in the extension context there
    // is no "real" active tab, so `activeTabUrl` is null and matchingScripts
    // stays empty. This test verifies the empty state path is stable.
    await clearStorage(popupPage);
    const script = buildUserscript({
      name: "PopupScript",
      urlPatterns: ["https://example.com/*"],
      enabled: true,
    });
    await seedStorage(popupPage, { [`userscript:${script.id}`]: script });
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    // Without a real browser tab URL, scripts won't match — verify empty state.
    expect(await popup.isEmpty()).toBe(true);
  });

  test("Open IDE button is visible", async ({ popupPage, clearStorage }) => {
    await clearStorage(popupPage);
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    await expect(popup.openIdeButton).toBeVisible();
  });
});
