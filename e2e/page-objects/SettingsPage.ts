import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the Settings page (sidebar tab "Settings" in Options).
 */
export class SettingsPage {
  constructor(readonly page: Page) {}

  /** Waits for the settings page to load (spinner gone). */
  async waitForReady() {
    await this.page
      .getByText("Loading settings...")
      .waitFor({ state: "hidden", timeout: 10_000 });
  }

  // ─── Select helpers ───────────────────────────────────────────────────────

  /**
   * The first `<div>` that has a direct-child `<label>` with the given text.
   * Matches the custom Select wrapper for the App Theme select.
   */
  private getSelectContainer(labelText: string, index = 0): Locator {
    return this.page
      .locator(`div:has(> label:has-text("${labelText}"))`)
      .nth(index);
  }

  private async chooseSelectOption(container: Locator, optionLabel: string) {
    // Click the toggle (first button in the wrapper)
    await container.locator("button").first().click();
    // Use exact regex to avoid matching option labels that are prefixes of others
    // (e.g. "Obsidian" must not match "Obsidian Deep", "Obsidian Ember", etc.)
    const exactRegex = new RegExp(
      `^${optionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
    );
    await container.locator("button").filter({ hasText: exactRegex }).click();
  }

  /** Change the Application Theme. */
  async setAppTheme(displayName: string) {
    const container = this.getSelectContainer("Theme", 0);
    await this.chooseSelectOption(container, displayName);
  }

  /** Change the Editor Theme. */
  async setEditorTheme(displayName: string) {
    const container = this.getSelectContainer("Theme", 1);
    await this.chooseSelectOption(container, displayName);
  }

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /** Get the Font Size `<input>`. */
  get fontSizeInput() {
    return this.page
      .locator("label")
      .filter({ hasText: /^Font Size$/i })
      .locator("~ input");
  }

  /** Get the Tab Size `<input>`. */
  get tabSizeInput() {
    return this.page
      .locator("label")
      .filter({ hasText: /^Tab Size$/i })
      .locator("~ input");
  }

  async setFontSize(size: number) {
    // Input is a sibling after the label (label + input pattern)
    const input = this.page
      .locator("div")
      .filter({ has: this.page.getByText("Font Size", { exact: true }) })
      .first()
      .locator("input");
    await input.fill(String(size));
    await input.press("Tab");
  }

  // ─── Checkboxes ───────────────────────────────────────────────────────────

  /** Toggle "Format on save". Returns after click. */
  async toggleAutoFormat() {
    await this.page.getByLabel("Format on save").click();
  }

  /** Toggle "Minify compiled JavaScript and CSS" and wait for the toast. */
  async toggleMinify() {
    await this.page.getByLabel("Minify compiled JavaScript and CSS").click();
    // Monaco editor renders role=alert aria-atomic=true live regions; exclude them
    // so we only match the actual toast notification div (no aria-atomic attribute).
    await this.page
      .locator("[role='alert']:not([aria-atomic='true'])")
      .waitFor({ timeout: 20_000 });
  }

  // ─── Assertions ──────────────────────────────────────────────────────────

  /** Read the current data-theme attribute on <html>. */
  async getDocumentTheme(): Promise<string | null> {
    return this.page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );
  }
}
