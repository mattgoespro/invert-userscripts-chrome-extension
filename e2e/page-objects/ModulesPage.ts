import type { Page } from "@playwright/test";

/**
 * Page Object Model for the Modules page (sidebar tab "Modules" in Options).
 */
export class ModulesPage {
  constructor(readonly page: Page) {}

  get addButton() {
    return this.page.getByRole("button", { name: "Add module", exact: true });
  }

  /** The modules table row for a module name. */
  moduleRow(name: string) {
    return this.page
      .getByTestId("module-row")
      .filter({ has: this.page.getByText(name, { exact: true }) });
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
    await this.page.getByPlaceholder(/cdnjs|jsdelivr/i).fill(url);

    // Submit with the "Add Module" button inside the dialog
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add Module$/i })
      .click();
  }

  /**
   * Delete a module by its display name.
   * Accepts the confirm() dialog automatically.
   */
  async deleteModule(name: string) {
    this.page.on("dialog", (dialog) => dialog.accept());
    await this.moduleRow(name)
      .getByRole("button", { name: `Delete ${name}`, exact: true })
      .click();
  }

  /**
   * Toggle the enabled/disabled checkbox for a module by name.
   */
  async toggleModule(name: string) {
    await this.moduleRow(name).locator("input[type='checkbox']").click();
  }

  /** Returns true if the module card for the given name is present. */
  async hasModule(name: string): Promise<boolean> {
    return this.page.getByText(name, { exact: true }).isVisible();
  }

  /** Get all module card names. */
  async getModuleNames(): Promise<string[]> {
    return this.page.getByTestId("module-name").allTextContents();
  }
}
