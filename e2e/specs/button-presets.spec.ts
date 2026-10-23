import { test, expect } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";

test("action buttons use compact presets and match adjacent inputs", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.reload();
  const options = new OptionsPage(optionsPage);
  await options.waitForReady();
  await options.clickTab("modules");
  const add = optionsPage.getByRole("button", {
    name: "Add module",
    exact: true,
  });
  await expect(add).toHaveCSS("height", "32px");
  await expect(add).toHaveCSS("font-size", "13px");
  await expect(add).toHaveAttribute("type", "button");
  await add.click();
  const dialog = optionsPage.getByRole("dialog");
  const close = dialog.getByRole("button", {
    name: "Close dialog",
    exact: true,
  });
  await expect(close).toHaveCSS("height", "26px");
  await expect(close).toHaveCSS("width", "26px");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await options.clickTab("scripts");
  await new ScriptsPage(optionsPage).openImportDialog();
  const select = optionsPage.getByRole("button", {
    name: "Select",
    exact: true,
  });
  await expect(select).toHaveCSS("height", "32px");
  const input = optionsPage.getByRole("textbox", {
    name: "Select userscripts file",
  });
  expect(await select.evaluate((node: HTMLElement) => node.offsetHeight)).toBe(
    await input.evaluate((node: HTMLElement) => node.offsetHeight)
  );
  await optionsPage
    .getByRole("button", { name: "Cancel", exact: true })
    .click();

  await options.clickTab("settings");
  await optionsPage
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  const storage = optionsPage.getByRole("button", {
    name: /^(Connect|Disconnect)$/,
  });
  await expect(storage).toHaveCSS("height", "32px");
  const dimensions = await storage.evaluate((node) => ({
    width: node.getBoundingClientRect().width,
    parent: node.parentElement!.getBoundingClientRect().width,
  }));
  expect(dimensions.width).toBeLessThan(dimensions.parent);
});
