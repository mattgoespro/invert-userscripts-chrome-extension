import { expect, type Page } from "@playwright/test";

/**
 * Page Object Model for the Scripts page (sidebar tab "Scripts" in Options).
 *
 * Assumes the page is already on options.html with the Scripts tab active.
 */
export class ScriptsPage {
  constructor(readonly page: Page) {}

  // ─── Script List ──────────────────────────────────────────────────────────

  /** The sidebar panel containing the script list. */
  get scriptListPanel() {
    // react-resizable-panels v4 renders id and data-testid (not data-panel-id)
    return this.page.locator("[data-testid='scripts-sidebar']");
  }

  /** Create a new script and wait for it to appear in the list. */
  async createScript() {
    // Count current checkboxes before creating so each call reliably waits
    // for its own new script — .first() would immediately resolve for call 2+.
    const before = await this.scriptListPanel
      .locator("input[type='checkbox']")
      .count();
    await this.page.getByTitle("Create new script").click();
    await expect(
      this.scriptListPanel.locator("input[type='checkbox']")
    ).toHaveCount(before + 1, { timeout: 15_000 });
  }

  /**
   * Click a script in the list by name. Scoped to the sidebar panel to avoid
   * matching the script name appearing elsewhere on the page.
   */
  async selectScript(name: string) {
    await this.scriptListPanel.getByText(name, { exact: true }).click();
    await this.page.waitForSelector(".monaco-editor[data-uri]", {
      timeout: 15_000,
    });
  }

  /** Get all script names currently shown in the list. */
  async getScriptNames(): Promise<string[]> {
    // Script name spans have overflow-hidden (unique to ScriptListItem name spans,
    // excludes the '//' decoration span in the header)
    const spans = this.scriptListPanel.locator(
      "span[class*='overflow-hidden']"
    );
    return spans.allTextContents();
  }

  /** Toggle the enabled/disabled switch for a script by name. */
  async toggleScript(name: string) {
    const item = this.scriptListPanel
      .locator("div")
      .filter({ has: this.page.getByText(name, { exact: true }) });
    // Click the visible label wrapper (triggers the hidden checkbox via HTML label behavior).
    // The label has explicit dimensions (h-5 w-9) so it's always in the viewport.
    await item.locator("label.switch--wrapper").first().click();
    // Wait for the toggleUserscript thunk to write to chrome.storage.sync.
    await this.page.waitForFunction(
      async () => {
        const data = await chrome.storage.sync.get(null);
        return Object.keys(data).some((k) => k.startsWith("userscript:"));
      },
      undefined,
      { timeout: 15_000 }
    );
  }

  /** Check whether the script's modified pulse indicator is visible. */
  async isScriptModified(name: string): Promise<boolean> {
    const item = this.scriptListPanel
      .locator("div")
      .filter({ has: this.page.getByText(name, { exact: true }) });
    return item.locator(".animate-pulse-indicator").isVisible();
  }

  // ─── Script Metadata ──────────────────────────────────────────────────────

  /** The name input in the editor toolbar. */
  get scriptNameInput() {
    return this.page.getByPlaceholder("Script name...");
  }

  /** Change the script name. Uses `fill` to replace the value entirely. */
  async setScriptName(name: string) {
    await this.scriptNameInput.fill(name);
    await this.scriptNameInput.press("Tab");
    // Wait for the updateUserscript thunk to complete: the sidebar reflects the new
    // name only after the fulfilled action updates Redux state.
    await expect(this.scriptListPanel).toContainText(name, { timeout: 15_000 });
  }

  /** Open the URL pattern dropdown, add a pattern, and wait for it to be saved. */
  async addUrlPattern(pattern: string) {
    // Click the toggle button to open the dropdown
    const toggle = this.page.locator("button").filter({ hasText: /urls:/ });
    await toggle.click();

    // The dropdown input placeholder changes based on count
    const input = this.page
      .getByPlaceholder("https://*.example.com/* — Enter to add")
      .or(this.page.getByPlaceholder("Add pattern..."));

    await input.fill(pattern);
    await input.press("Enter");

    // Wait for the updateUserscript thunk to complete:
    // the [N] count badge in the toggle only appears after Redux processes
    // the fulfilled action (storage write has completed).
    await expect(toggle).toContainText("[", { timeout: 15_000 });
  }

  // ─── Options Panel ────────────────────────────────────────────────────────

  /** Open the ⋮ script options panel. */
  async openOptionsPanel() {
    await this.page.getByTitle("Script options").click();
  }

  /** Close the options panel by pressing Escape. */
  async closeOptionsPanel() {
    await this.page.keyboard.press("Escape");
  }

  /** Set the module name for sharing (opens options panel, fills field, closes). */
  async setModuleName(moduleName: string) {
    await this.openOptionsPanel();
    const input = this.page.getByPlaceholder("module-name");
    await input.fill(moduleName);
    await input.press("Tab");
  }

  /**
   * Delete the currently-selected script.
   * Accepts the confirm() dialog automatically.
   */
  async deleteCurrentScript() {
    this.page.on("dialog", (dialog) => dialog.accept());
    await this.openOptionsPanel();
    await this.page.getByRole("button", { name: /Delete script/i }).click();
  }

  // ─── Code Editors ────────────────────────────────────────────────────────

  /** Type into the TypeScript editor and save with Ctrl+S. */
  async saveTypescriptCode(code: string, scriptName?: string) {
    const editor = this.page
      .locator("[data-testid='typescript-source'] .monaco-editor")
      .first();
    await editor.click();
    // Select all existing content and replace
    await this.page.keyboard.press("Control+a");
    await this.page.keyboard.type(code);
    await this.page.keyboard.press("Control+s");

    if (scriptName) {
      const item = this.scriptListPanel
        .locator("div")
        .filter({ has: this.page.getByText(scriptName, { exact: true }) });
      await expect(item.locator(".animate-pulse-indicator")).not.toBeVisible({
        timeout: 15_000,
      });
    }

    await this.page.waitForFunction(
      () =>
        chrome.storage.sync
          .get(null)
          .then((data) =>
            Object.keys(data).some(
              (key) => key.startsWith("userscript:") && !key.includes(":chunk:")
            )
          ),
      undefined,
      { timeout: 15_000 }
    );
  }

  // ─── Compiled Output Drawer ───────────────────────────────────────────────

  /** Click a drawer tab: "javascript", "css", or "errors". */
  async clickDrawerTab(tab: "javascript" | "css" | "errors") {
    await this.page
      .locator("[data-testid='output-drawer']")
      .getByText(tab, { exact: false })
      .first()
      .click();
  }

  /** Read the text content of the compiled output in the drawer. */
  async getCompiledOutput(): Promise<string> {
    const drawer = this.page.locator("[data-panel-id='output-drawer']");
    // Read visible Monaco editor lines
    const lines = drawer.locator(".view-line");
    return (await lines.allTextContents()).join("\n");
  }

  // ─── Import / Export ─────────────────────────────────────────────────────

  /** Open the Scripts actions menu (⋮). */
  async openActionsMenu() {
    await this.page.getByTitle("Script list options").click();
  }

  /** Trigger export and wait for the download event. */
  async exportScripts() {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this._clickActionsMenuItem("Export"),
    ]);
    return download;
  }

  /** Trigger the import dialog. */
  async openImportDialog() {
    await this._clickActionsMenuItem("Import");
  }

  private async _clickActionsMenuItem(label: "Import" | "Export") {
    await this.page.getByTitle("Script list options").click();
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }
}
