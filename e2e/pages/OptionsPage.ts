import type { Page } from "@playwright/test";

type SidebarTab = "scripts" | "modules" | "settings";

const TAB_TITLES: Record<SidebarTab, string> = {
  scripts: "Scripts",
  modules: "Modules",
  settings: "Settings",
};

/**
 * Page Object Model for the Options page (chrome-extension://{id}/options.html).
 */
export class OptionsPage {
  constructor(readonly page: Page) {}

  /** Wait for the sidebar navigation to be ready — confirms the React app has mounted. */
  async waitForReady() {
    // [title="Scripts"] appears once GlobalStateProvider finishes loading from storage.
    // This works on all tabs (scripts, modules, settings) because the sidebar nav is always rendered.
    await this.page.waitForSelector('[title="Scripts"]', { timeout: 15_000 });
  }

  /** Wait for at least one Monaco editor to be mounted. Call after navigating to a script. */
  async waitForEditorReady() {
    await this.page.waitForSelector(".monaco-editor[data-uri]", {
      timeout: 15_000,
    });
  }

  async clickTab(tab: SidebarTab) {
    await this.page.getByTitle(TAB_TITLES[tab]).click();
  }

  /** Reload the page and wait for the sidebar to be ready. */
  async reload() {
    await this.page.reload();
    await this.waitForReady();
  }
}
