import { expect, type Locator, type Page } from "@playwright/test";

export function editorNeedle(code: string): string {
  const match = code.match(/export\s+const\s+(\w+)\s*=\s*([^;]+)/);
  if (match) {
    return `${match[1]} = ${match[2].trim()}`;
  }

  return code.trim();
}
export function normalizeMonacoText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function typescriptEditor(page: Page) {
  return page
    .locator("[data-testid='typescript-source'] .monaco-editor")
    .first();
}

export async function replaceMonacoEditorContent(
  editor: Locator,
  code: string
) {
  await editor.click();
  await editor.page().keyboard.press("Control+a");
  await editor.page().keyboard.type(code, { delay: 5 });
}

/**
 * Trigger the CodeEditor Ctrl+S handler. Playwright's keyboard shortcut does
 * not always reach the editor root listener, so dispatch the event directly.
 */
export async function saveMonacoEditor(page: Page) {
  await page.evaluate(() => {
    const monacoEditor = document.querySelector(
      "[data-testid='typescript-source'] .monaco-editor"
    );
    const editorRoot = monacoEditor?.parentElement;

    if (!editorRoot) {
      throw new Error("[e2e] Could not find TypeScript editor root element.");
    }

    editorRoot.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

export async function readTypescriptEditorText(page: Page): Promise<string> {
  const text = await page
    .locator("[data-testid='typescript-source'] .view-lines")
    .innerText();
  return normalizeMonacoText(text);
}

export async function waitForTypescriptEditorText(
  page: Page,
  substring: string,
  timeout = 15_000
) {
  await expect
    .poll(async () => readTypescriptEditorText(page), { timeout })
    .toContain(substring);
}
