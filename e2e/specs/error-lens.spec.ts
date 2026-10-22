import type { Locator } from "@playwright/test";
import { test, expect, buildUserscript } from "../fixtures";
import { readStoredUserscripts } from "../helpers/chrome-sync";
import {
  normalizeMonacoText,
  replaceMonacoEditorContent,
  saveMonacoEditor,
  typescriptEditor,
} from "../helpers/monaco";
import { OptionsPage, ScriptsPage } from "../page-objects";

async function lensText(messages: Locator): Promise<string> {
  // Combine diagnostic text and normalize spaces independently of rendering.
  return normalizeMonacoText((await messages.allTextContents()).join(""));
}

async function expectLensMessage(
  messages: Locator,
  expected: string
): Promise<void> {
  await expect
    .poll(() => lensText(messages), { timeout: 20_000 })
    .toContain(expected);
  await expect(messages.first()).toBeVisible();
  const diagnosticColor = await messages.first().evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = element.classList.contains("error-lens-error")
      ? "var(--vscode-editorError-foreground)"
      : "var(--vscode-editorWarning-foreground)";
    element.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(messages.first()).toHaveCSS("color", diagnosticColor);
}

test.describe("Editor error lens", () => {
  test.describe.configure({ timeout: 60_000 });

  test("shows live errors, preserves saved source, and clears across fixes and model switches", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }) => {
    const brokenSource = 'export const count: number = "wrong";';
    const broken = buildUserscript({
      name: "Broken Lens",
      moduleName: "broken-lens",
      enabled: false,
      code: {
        source: { typescript: brokenSource, scss: "" },
        compiled: { javascript: "", css: "" },
      },
    });
    const clean = buildUserscript({
      name: "Clean Lens",
      moduleName: "clean-lens",
      enabled: false,
      code: {
        source: { typescript: "export const clean = 1;", scss: "" },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${broken.id}`]: broken,
      [`userscript:${clean.id}`]: clean,
      editorSettings: { autoFormat: false },
      globalState: {
        activeSidebarTab: "scripts",
        selectedScriptId: broken.id,
        outputDrawerCollapsed: true,
      },
    });
    await optionsPage.reload();
    await new OptionsPage(optionsPage).waitForReady();
    const scripts = new ScriptsPage(optionsPage);
    await scripts.selectScript(broken.name, 'count: number = "wrong"');
    const editor = typescriptEditor(optionsPage);
    const error = editor.locator(".error-lens-message.error-lens-error");

    await expectLensMessage(
      error,
      "Type 'string' is not assignable to type 'number'."
    );
    await expect(
      editor.locator(".error-lens-line-error").first()
    ).toBeVisible();

    // Save with an annotation still visible: view-only diagnostics must stay
    // outside the model text that the existing save pipeline publishes.
    const editedSource = 'export const count: number = "still wrong";';
    await replaceMonacoEditorContent(editor, editedSource);
    await expect(error.first()).toBeVisible({ timeout: 20_000 });
    await saveMonacoEditor(optionsPage);
    await expect
      .poll(
        async () =>
          (await readStoredUserscripts(optionsPage)).find(
            (script) => script.id === broken.id
          )?.typescript,
        { timeout: 20_000 }
      )
      .toBe(editedSource);

    await scripts.selectScript(clean.name, "clean = 1");
    await expect(editor.locator(".error-lens-message")).toHaveCount(0);
    await expect(editor.locator(".error-lens-line-error")).toHaveCount(0);

    await scripts.selectScript(broken.name, 'count: number = "still wrong"');
    await expectLensMessage(
      error,
      "Type 'string' is not assignable to type 'number'."
    );

    await replaceMonacoEditorContent(editor, "export const count: number = 2;");
    await expect(editor.locator(".error-lens-message")).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(editor.locator(".error-lens-line-error")).toHaveCount(0);
  });

  test("shows warnings once and annotates declaration and SCSS panes independently", async ({
    optionsPage,
    clearStorage,
    seedStorage,
  }, testInfo) => {
    await optionsPage.setViewportSize({ width: 1440, height: 900 });
    const script = buildUserscript({
      name: "Lens Severities",
      moduleName: "lens-severities",
      enabled: false,
      typeDefinitions: "declare const bad: MissingErrorLensType;",
      code: {
        source: {
          typescript: [
            "export function example() {",
            "  const unused = 1;",
            "  return 2;",
            "}",
          ].join("\n"),
          scss: ".probe { colr: red; }",
        },
        compiled: { javascript: "", css: "" },
      },
    });

    await clearStorage(optionsPage);
    await seedStorage(optionsPage, {
      [`userscript:${script.id}`]: script,
      globalState: {
        activeSidebarTab: "scripts",
        selectedScriptId: script.id,
        outputDrawerCollapsed: true,
      },
    });
    await optionsPage.reload();
    await new OptionsPage(optionsPage).waitForReady();
    await new ScriptsPage(optionsPage).selectScript(script.name, "example()");

    const sourceEditor = typescriptEditor(optionsPage);
    const warning = sourceEditor.locator(
      ".error-lens-message.error-lens-warning"
    );
    const warningMessage = "'unused' is declared but its value is never read.";
    await expectLensMessage(warning, warningMessage);
    // The app also promotes TypeScript hint markers under another owner.
    // The original and promoted markers must render as one annotation.
    await expect
      .poll(
        async () => (await lensText(warning)).split(warningMessage).length - 1
      )
      .toBe(1);
    await expect(
      sourceEditor.locator(".error-lens-line-warning").first()
    ).toBeVisible();

    const definitionsEditor = optionsPage.locator(
      "[data-testid='typescript-definitions'] .monaco-editor"
    );
    await expectLensMessage(
      definitionsEditor.locator(".error-lens-message.error-lens-error"),
      "Cannot find name 'MissingErrorLensType'."
    );
    await expect(
      definitionsEditor.locator(".error-lens-line-error").first()
    ).toBeVisible();

    const scssEditor = optionsPage.locator("#scss-editor .monaco-editor");
    await expectLensMessage(
      scssEditor.locator(".error-lens-message.error-lens-warning"),
      "Unknown property: 'colr'"
    );
    await expect(
      scssEditor.locator(".error-lens-line-warning").first()
    ).toBeVisible();
    await optionsPage.screenshot({
      path: testInfo.outputPath("error-lens.png"),
    });

    await replaceMonacoEditorContent(scssEditor, ".probe { color: red; }");
    await expect(scssEditor.locator(".error-lens-message")).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect
      .poll(
        async () => (await lensText(warning)).split(warningMessage).length - 1
      )
      .toBe(1);
    await expect(
      definitionsEditor.locator(".error-lens-message.error-lens-error").first()
    ).toBeVisible();

    // An error and an unused-local hint share this line. Show the strongest
    // severity and count the hint once despite its promoted warning marker.
    await replaceMonacoEditorContent(
      sourceEditor,
      [
        "export function example() {",
        "  const unused: string = 1;",
        "  return 2;",
        "}",
      ].join("\n")
    );
    await expectLensMessage(
      sourceEditor.locator(".error-lens-message.error-lens-error"),
      "Type 'number' is not assignable to type 'string'. (+1 more)"
    );
    await expect(warning).toHaveCount(0);
  });
});
