import { test, expect, buildUserscript } from "../fixtures";
import { ScriptsPage } from "../page-objects";
import { installReduxAudit, readReduxActions } from "../helpers/redux-audit";

test("drawer collapse actions only dispatch when the collapsed state changes", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({ name: "Drawer resize" });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, {
    [`userscript:${script.id}`]: script,
    globalState: {
      activeSidebarTab: "scripts",
      selectedScriptId: script.id,
      outputDrawerCollapsed: false,
    },
  });
  await installReduxAudit(optionsPage);
  await optionsPage.reload();
  await new ScriptsPage(optionsPage).selectScript(script.name);
  await expect(optionsPage.getByTitle("Collapse drawer")).toBeVisible();

  const collapseActions = async (): Promise<number> =>
    (await readReduxActions(optionsPage)).filter(
      (action) => action.type === "ui/setOutputDrawerCollapsed"
    ).length;

  const resizeViewport = async (): Promise<void> => {
    // Docked DevTools resizing changes the page viewport in the same way.
    for (const viewport of [
      { width: 1200, height: 900 },
      { width: 1000, height: 800 },
      { width: 1100, height: 700 },
      { width: 950, height: 850 },
      { width: 1200, height: 900 },
    ]) {
      await optionsPage.setViewportSize(viewport);
      await optionsPage.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          })
      );
    }
  };

  await resizeViewport();
  expect(await collapseActions()).toBe(0);
  await expect(optionsPage.getByTitle("Collapse drawer")).toBeVisible();

  await optionsPage.getByTitle("Collapse drawer").click();
  await expect(optionsPage.getByTitle("Expand drawer")).toBeVisible();
  // Also proves the action observer is active, so zero counts are meaningful.
  await expect.poll(collapseActions).toBe(1);

  await resizeViewport();
  expect(await collapseActions()).toBe(1);
  await expect(optionsPage.getByTitle("Expand drawer")).toBeVisible();

  await optionsPage.getByTitle("Expand drawer").click();
  await expect(optionsPage.getByTitle("Collapse drawer")).toBeVisible();
  await expect.poll(collapseActions).toBe(2);

  await resizeViewport();
  expect(await collapseActions()).toBe(2);

  const separator = optionsPage.locator(
    '#script-editor-outer-panels > [role="separator"]'
  );
  const handle = await separator.boundingBox();
  if (!handle) {
    throw new Error("Output drawer resize handle is not visible");
  }
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await optionsPage.mouse.move(x, y);
  await optionsPage.mouse.down();
  await optionsPage.mouse.move(x, y - 50, { steps: 10 });
  await optionsPage.mouse.up();
  await expect(optionsPage.getByTitle("Collapse drawer")).toBeVisible();
  expect(await collapseActions()).toBe(2);

  const drawer = await optionsPage.getByTestId("output-drawer").boundingBox();
  if (!drawer) {
    throw new Error("Output drawer is not visible");
  }
  await optionsPage.mouse.move(x, y - 50);
  await optionsPage.mouse.down();
  await optionsPage.mouse.move(x, drawer.y + drawer.height - 36, { steps: 10 });
  await optionsPage.mouse.up();
  await expect(optionsPage.getByTitle("Expand drawer")).toBeVisible();
  await expect.poll(collapseActions).toBe(3);
});
