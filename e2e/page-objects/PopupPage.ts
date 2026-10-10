import type { Page } from "@playwright/test";

/**
 * Page Object Model for the extension Popup (chrome-extension://{id}/popup.html).
 */
export class PopupPage {
  constructor(readonly page: Page) {}

  /** Wait until the "Loading..." spinner is gone. */
  async waitForReady() {
    await this.page.getByText("Loading...").waitFor({ state: "hidden", timeout: 10_000 });
  }

  /** Get the "Open IDE" icon button. */
  get openIdeButton() {
    return this.page.getByTitle("Open IDE");
  }

  /** Open the Options page (navigates current page). */
  async openOptions() {
    await this.openIdeButton.click();
  }

  /** Returns true when the empty-state message is visible. */
  async isEmpty(): Promise<boolean> {
    return this.page.getByText("No scripts match this page").isVisible();
  }

  /** Get the count footer text, e.g. "2 scripts matching". */
  get matchingCountText() {
    return this.page.locator("text=/\\d+ scripts? matching/");
  }

  /** Get the matching script count from the footer. */
  async getMatchingCount(): Promise<number> {
    const text = await this.matchingCountText.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Get the names of all scripts listed in the popup. */
  async getScriptNames(): Promise<string[]> {
    // The popup reuses the <ScriptList> component which renders script names as spans
    const spans = this.page.locator("span[class*='font-mono']");
    return spans.allTextContents();
  }

  /** Toggle a script's enabled state in the popup by name. */
  async toggleScript(name: string) {
    const row = this.page
      .locator("div")
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
    await row.locator("input[type='checkbox']").click();
  }
}
