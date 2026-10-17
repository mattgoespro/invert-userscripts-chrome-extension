import { test, expect, buildUserscript } from "../fixtures";
import { PopupPage } from "../page-objects";

test.describe("Popup", () => {
  test("shows empty state when no scripts match the current tab", async ({
    popupPage,
    extensionContext,
    clearStorage,
  }) => {
    await clearStorage(popupPage);
    await extensionContext.route("https://popup.invert.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Popup target</body></html>",
      })
    );
    const content = await extensionContext.newPage();
    await content.goto("https://popup.invert.test/");
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    expect(await popup.isEmpty()).toBe(true);
    await content.close();
  });

  test("shows matching scripts count in the footer", async ({
    popupPage,
    extensionContext,
    clearStorage,
    seedStorage,
  }) => {
    await clearStorage(popupPage);
    const script = buildUserscript({
      name: "PopupScript",
      urlPatterns: ["https://popup.invert.test/*"],
      enabled: false,
    });
    await seedStorage(popupPage, { [`userscript:${script.id}`]: script });
    await extensionContext.route("https://popup.invert.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Popup target</body></html>",
      })
    );
    const content = await extensionContext.newPage();
    await content.goto("https://popup.invert.test/");
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    await expect(popup.matchingCountText).toHaveText("1 script matching");
    await expect(
      popupPage.getByText("PopupScript", { exact: true })
    ).toBeVisible();
    await content.close();
  });

  test("Open IDE button is visible", async ({ popupPage, clearStorage }) => {
    await clearStorage(popupPage);
    await popupPage.reload();

    const popup = new PopupPage(popupPage);
    await popup.waitForReady();

    await expect(popup.openIdeButton).toBeVisible();
  });
});
