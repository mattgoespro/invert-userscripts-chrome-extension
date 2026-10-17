import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage } from "../page-objects";

test("script list defaults to display-name ordering, switches to creation order, and persists", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const scripts = [
    buildUserscript({
      id: "old",
      name: "Zulu",
      moduleName: "aaa",
      createdAt: 1000,
      enabled: false,
    }),
    buildUserscript({
      id: "new",
      name: "Alpha",
      moduleName: "zzz",
      createdAt: 3000,
      enabled: false,
    }),
    buildUserscript({
      id: "middle",
      name: "beta",
      createdAt: 2000,
      enabled: false,
    }),
  ];
  await seedStorage(
    optionsPage,
    Object.fromEntries(
      scripts.map((script) => ["userscript:" + script.id, script])
    )
  );
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  const names = optionsPage.locator(
    '[data-testid="scripts-sidebar"] .group > span'
  );
  await expect(names).toHaveText(["Alpha", "beta", "Zulu"]);
  await optionsPage.getByTitle("Script list options").click();
  const sort = optionsPage.getByRole("combobox", { name: "Sort by" });
  await expect(sort).toHaveValue("name");
  await sort.selectOption("created");
  await expect(names).toHaveText(["Zulu", "beta", "Alpha"]);
  // Wait for the real persisted layout preference, not a fixed debounce delay.
  await expect
    .poll(() =>
      optionsPage.evaluate(
        async () =>
          (await chrome.storage.sync.get("globalState")).globalState
            ?.scriptListSort
      )
    )
    .toBe("created");
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  await expect(names).toHaveText(["Zulu", "beta", "Alpha"]);
  await optionsPage.getByTitle("Script list options").click();
  await optionsPage
    .getByRole("combobox", { name: "Sort by" })
    .selectOption("name");
  await expect(names).toHaveText(["Alpha", "beta", "Zulu"]);
});

test("list menu stays unobscured at minimum width, repositions on resize, and supports keyboard dismissal", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, {
    globalState: { panelSizes: { scriptListSidebarWidth: 15 } },
  });
  await optionsPage.setViewportSize({ width: 1000, height: 700 });
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  const trigger = optionsPage.getByTitle("Script list options");
  for (const control of [
    trigger,
    optionsPage.getByTitle("Create new script"),
  ]) {
    await expect
      .poll(() =>
        control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const panel = element
            .closest('[data-testid="scripts-sidebar"]')!
            .getBoundingClientRect();
          return (
            rect.left >= panel.left &&
            rect.right <= panel.right &&
            element.contains(
              document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              )
            )
          );
        })
      )
      .toBe(true);
  }
  await trigger.focus();
  await trigger.press("Enter");
  const menu = optionsPage.getByRole("dialog", { name: "Script list options" });
  await expect(menu).toBeVisible();
  await expect(
    optionsPage.getByRole("combobox", { name: "Sort by" })
  ).toBeFocused();
  const visibleGeometry = () =>
    menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 8 &&
        rect.right <= innerWidth - 8 &&
        rect.top >= 8 &&
        rect.bottom <= innerHeight - 8 &&
        [rect.left + 4, rect.right - 4].every((x) =>
          element.contains(
            document.elementFromPoint(x, rect.top + rect.height / 2)
          )
        )
      );
    });
  await expect.poll(visibleGeometry).toBe(true);
  for (const label of ["Import", "Export"]) {
    const button = menu.getByRole("button", { name: label, exact: true });
    expect(
      await button.evaluate((element) => element.offsetHeight)
    ).toBeLessThanOrEqual(30);
  }
  await optionsPage.setViewportSize({ width: 820, height: 500 });
  await expect.poll(visibleGeometry).toBe(true);
  await optionsPage.screenshot({
    path: ".superpowers/script-list-menu-narrow.png",
    clip: { x: 0, y: 0, width: 420, height: 340 },
  });
  await optionsPage.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await optionsPage.getByTitle("Scripts", { exact: true }).click();
  await expect(menu).toBeHidden();
});
