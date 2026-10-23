import { expect, type Locator, type Page } from "@playwright/test";

export function editorNeedle(code: string): string {
  const match = code.match(/export\s+const\s+(\w+)\s*=\s*([^;]+)/);
  if (match) {
    return `${match[1]} = ${match[2].trim()}`;
  }

  return normalizeMonacoText(code);
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
export async function saveMonacoEditor(
  page: Page,
  source: "typescript-source" | "typescript-definitions" = "typescript-source"
) {
  await page.evaluate((testId) => {
    const monacoEditor = document.querySelector(
      `[data-testid='${testId}'] .monaco-editor`
    );
    const editorRoot = monacoEditor?.parentElement;

    if (!editorRoot) {
      throw new Error(`[e2e] Could not find ${testId} editor root element.`);
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
  }, source);
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

export async function waitForTypeDefinitionsEditorText(
  page: Page,
  substring: string,
  timeout = 15_000
) {
  await expect
    .poll(
      async () =>
        normalizeMonacoText(
          await page
            .locator("[data-testid='typescript-definitions'] .view-lines")
            .innerText()
        ),
      { timeout }
    )
    .toContain(substring);
}

/** Expand the script editor problems drawer so error messages are in the DOM. */
export async function expandProblemsDrawer(page: Page) {
  const expand = page.getByTitle("Expand drawer");
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  await expect(page.getByTitle("Collapse drawer")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("tab", { name: /^Problems(?:\s+\d+)?$/ }).click();
}

/**
 * Assert the visible script has no "Cannot find module" diagnostics.
 *
 * Monaco's TS worker can report a clean panel briefly before markers arrive,
 * so we require several consecutive clean polls after the panel has a settled
 * message ("No problems in this script" or any non-module diagnostic).
 */
export async function expectNoModuleImportErrors(page: Page, timeout = 20_000) {
  await expandProblemsDrawer(page);

  const problems = page.locator("[data-testid='output-drawer']");
  const deadline = Date.now() + timeout;
  let cleanStreak = 0;
  const requiredStreak = 4;

  while (Date.now() < deadline) {
    const text = await problems.innerText();
    const hasImportError = /Cannot find module/i.test(text);
    const settled =
      /No problems in this script/i.test(text) ||
      /(main\.ts|types\.d\.ts|styles\.scss) \d+:\d+/.test(text);

    if (hasImportError) {
      cleanStreak = 0;
    } else if (settled) {
      cleanStreak += 1;
      if (cleanStreak >= requiredStreak) {
        return;
      }
    } else {
      cleanStreak = 0;
    }

    await page.waitForTimeout(350);
  }

  const finalText = await problems.innerText();
  throw new Error(
    `Timed out waiting for shared-module imports to resolve.\nProblems panel:\n${finalText}`
  );
}

/**
 * Assert the visible script reports `Cannot find name '<identifier>'`.
 *
 * Monaco can flash a clean panel before markers arrive, so we wait until the
 * diagnostic is present rather than treating an empty panel as success.
 */
export async function expectCannotFindName(
  page: Page,
  identifier: string,
  timeout = 20_000
) {
  await expandProblemsDrawer(page);

  const problems = page.locator("[data-testid='output-drawer']");
  await expect(problems).toContainText(`Cannot find name '${identifier}'`, {
    timeout,
  });
}

/**
 * Assert the visible script has a fully clean problems panel.
 *
 * Monaco can flash "No problems in this script" before markers arrive, so we
 * ignore the empty state until `minWaitMs` has elapsed, fail immediately on
 * any diagnostic, and then require several consecutive clean polls.
 */
export async function expectNoEditorProblems(
  page: Page,
  timeout = 20_000,
  minWaitMs = 5_000
) {
  await expandProblemsDrawer(page);

  const problems = page.locator("[data-testid='output-drawer']");
  const started = Date.now();
  const deadline = started + timeout;
  let cleanStreak = 0;
  const requiredStreak = 4;

  while (Date.now() < deadline) {
    const text = await problems.innerText();
    const hasDiagnostic = /Line\s+\d+:\d+/i.test(text);
    const cannotFindName = /Cannot find name/i.test(text);
    const settledClean = /No problems in this script/i.test(text);

    if (hasDiagnostic || cannotFindName) {
      throw new Error(
        `Userscript editor reported type/declaration problems.\nProblems panel:\n${text}`
      );
    }

    if (Date.now() - started < minWaitMs) {
      await page.waitForTimeout(350);
      continue;
    }

    if (settledClean) {
      cleanStreak += 1;
      if (cleanStreak >= requiredStreak) {
        return;
      }
    } else {
      cleanStreak = 0;
    }

    await page.waitForTimeout(350);
  }

  const finalText = await problems.innerText();
  throw new Error(
    `Timed out waiting for the problems panel to stay clean.\nProblems panel:\n${finalText}`
  );
}

/**
 * Open the Monaco quick-fix widget on `identifier` in the visible userscript
 * and return the action titles. Matches the Invert IDE lightbulb menu.
 */
export async function listQuickFixTitles(
  page: Page,
  identifier: string,
  timeout = 15_000
): Promise<string[]> {
  const line = page
    .locator("[data-testid='typescript-source'] .view-line")
    .filter({ hasText: identifier })
    .first();
  await expect(line).toBeVisible({ timeout });
  await line.click();

  await page.keyboard.press("Control+Period");

  const widget = page.locator(".action-widget").last();
  await expect(widget).toBeVisible({ timeout });

  const rows = widget.locator(".monaco-list-row");
  await expect(rows.first()).toBeVisible({ timeout });

  return rows.allInnerTexts();
}
