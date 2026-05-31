import path from "path";
import { test, expect, buildUserscript } from "../../fixtures";
import { OptionsPage, ScriptsPage } from "../../pages";

const FIXTURE_FILE = path.join(import.meta.dirname, "../data/scripts.json");

test.describe("Scripts — import / export", () => {
  test("exports scripts as a downloadable JSON file", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const script = buildUserscript({ name: "ExportMe" });
    await clearStorage(optionsPage);
    await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();
    const download = await scripts.exportScripts();

    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const content = await download.createReadStream();
    let raw = "";
    for await (const chunk of content) {
      raw += chunk.toString();
    }

    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("userscripts");
    expect(Array.isArray(parsed.userscripts)).toBe(true);
    expect(parsed.userscripts[0].name).toBe("ExportMe");
  });

  test("imports scripts from a JSON file and shows them in the list", async ({
    optionsPage,
    clearStorage,
  }) => {
    await clearStorage(optionsPage);
    await optionsPage.reload();

    const options = new OptionsPage(optionsPage);
    const scripts = new ScriptsPage(optionsPage);

    await options.waitForReady();

    // Open import dialog via the actions menu
    await scripts.openImportDialog();

    // The import dialog has a file input; use setInputFiles
    const fileInput = optionsPage.locator("input[type='file']");
    await fileInput.setInputFiles(FIXTURE_FILE);

    // Wait for file validation to pass (button becomes enabled)
    const importButton = optionsPage.getByRole("button", { name: /^Import$/i });
    await expect(importButton).toBeEnabled({ timeout: 10_000 });
    await importButton.click();

    // Wait for the dialog to close (import completed) then check the list
    await optionsPage
      .locator("[role='dialog']")
      .waitFor({ state: "hidden", timeout: 30_000 });

    // The imported script should appear in the list
    await expect(scripts.scriptListPanel).toContainText("FixtureScript", {
      timeout: 15_000,
    });
  });
});
