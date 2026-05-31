import type { Page } from "@playwright/test";

/**
 * Page Object Model for the Modules page (sidebar tab "Modules" in Options).
 */
export class ModulesPage {
  constructor(readonly page: Page) {}

  get addButton() {
    return this.page.getByRole("button", { name: /\+ Add Module/i });
  }

  /** Open the "Add Module" dialog. */
  async openAddModuleDialog() {
    await this.addButton.click();
  }

  /**
   * Add a global module via the dialog.
   * @param name       - Display name, e.g. "Moment.js"
   * @param url        - CDN URL, e.g. "https://cdn.jsdelivr.net/..."
   */
  async addModule(name: string, url: string) {
    await this.openAddModuleDialog();

    await this.page.getByPlaceholder("e.g. Moment.js").fill(name);
    await this.page
      .getByPlaceholder(/cdnjs|jsdelivr/i)
      .fill(url);

    // Submit with the "Add Module" button inside the dialog
    await this.page.getByRole("button", { name: /^Add Module$/i }).click();
  }

  /**
   * Delete a module by its display name.
   * Accepts the confirm() dialog automatically.
   */
  async deleteModule(name: string) {
    this.page.on("dialog", (dialog) => dialog.accept());
    const card = this.page
      .locator("div")
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
    await card.getByRole("button").first().click();
  }

  /**
   * Toggle the enabled/disabled checkbox for a module by name.
   */
  async toggleModule(name: string) {
    const card = this.page
      .locator("div")
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
    await card.locator("input[type='checkbox']").click();
  }

  /** Returns true if the module card for the given name is present. */
  async hasModule(name: string): Promise<boolean> {
    return this.page.getByText(name, { exact: true }).isVisible();
  }

  /** Get all module card names. */
  async getModuleNames(): Promise<string[]> {
    // Module name is rendered in a <span> with font-heading inside the card
    const spans = this.page.locator("span[class*='font-heading']");
    return spans.allTextContents();
  }
}
