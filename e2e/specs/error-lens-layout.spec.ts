import { test, expect, buildUserscript } from "../fixtures";
import { OptionsPage, ScriptsPage } from "../page-objects";
import { expandProblemsDrawer, typescriptEditor } from "../helpers/monaco";

test("Error Lens clips to one line, retains full hover text, and resizes with the editor", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}, testInfo) => {
  await optionsPage.setViewportSize({ width: 1400, height: 900 });
  const source = [
    "interface Profile {",
    "  displayName: string;",
    "  description: string;",
    "  avatarUrl: string;",
    "  createdAt: string;",
    "  updatedAt: string;",
    "  accountId: string;",
    "}",
    "export const p: Profile = {};",
    "export const tail = 1;",
  ].join("\n");
  const script = buildUserscript({
    name: "Clipped Lens",
    code: {
      source: { typescript: source, scss: "" },
      compiled: { javascript: "", css: "" },
    },
  });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  await new ScriptsPage(optionsPage).selectScript(
    script.name,
    "export const p"
  );
  const collapse = optionsPage.getByTitle("Collapse drawer");
  if (await collapse.isVisible()) {
    await collapse.click();
  }
  const editor = typescriptEditor(optionsPage);
  const message = editor.locator(".error-lens-message");
  await expect(message.first()).toBeVisible({ timeout: 20_000 });
  await expect(message).toHaveCount(1);
  await expect(message).toHaveCSS("white-space", "nowrap");
  await expect(message).toHaveCSS("text-overflow", "ellipsis");
  const fullMessage = (await message.textContent())!.trim();
  expect(fullMessage).toContain("displayName");
  await message.hover();
  await expect(message).toHaveAttribute("title", fullMessage);

  const checkLayout = async (): Promise<void> => {
    await expect
      .poll(() =>
        message.evaluate((node) => node.scrollWidth > node.clientWidth)
      )
      .toBe(true);
    const boxes = await editor.locator(".view-line").evaluateAll((lines) => {
      const problem = lines.find((line) =>
        line.textContent?.replace(/\u00a0/g, " ").includes("export const p:")
      );
      const next = lines.find((line) =>
        line.textContent?.replace(/\u00a0/g, " ").includes("export const tail")
      );
      if (!problem || !next) {
        throw new Error("Expected both source lines to remain visible");
      }
      return {
        first: problem.getBoundingClientRect().toJSON(),
        next: next.getBoundingClientRect().toJSON(),
      };
    });
    expect(Math.round(boxes.next.top - boxes.first.top)).toBe(
      Math.round(boxes.first.height)
    );
    const messageBox = await message.boundingBox();
    const editorBox = await editor.boundingBox();
    expect(messageBox!.x + messageBox!.width).toBeLessThanOrEqual(
      editorBox!.x + editorBox!.width
    );
  };
  await checkLayout();
  await optionsPage.setViewportSize({ width: 1000, height: 900 });
  await checkLayout();
  await editor.screenshot({
    path: testInfo.outputPath("single-line-error-lens.png"),
  });
});

test("custom window properties are allowed while built-in and ordinary object type errors remain", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  const script = buildUserscript({
    name: "Dynamic Window",
    code: {
      source: {
        typescript: [
          "window.log = console.log;",
          'window.log("hello");',
          "window.toaster = null;",
          "console.log(window.toaster);",
          "window.name = 42;",
          'export const wrong: number = "wrong";',
          "const ordinary = { value: 1 };",
          "console.log(ordinary.missing);",
        ].join("\n"),
        scss: "",
      },
      compiled: { javascript: "", css: "" },
    },
  });
  await clearStorage(optionsPage);
  await seedStorage(optionsPage, { [`userscript:${script.id}`]: script });
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  await new ScriptsPage(optionsPage).selectScript(script.name, "window.log");
  await expandProblemsDrawer(optionsPage);
  const problems = optionsPage.getByTestId("output-drawer");
  await expect(problems).toContainText(
    "Type 'number' is not assignable to type 'string'.",
    { timeout: 20_000 }
  );
  await expect(problems).toContainText(
    "Type 'string' is not assignable to type 'number'."
  );
  await expect(problems).toContainText("Property 'missing' does not exist");
  await expect(problems).not.toContainText("Property 'log' does not exist");
  await expect(problems).not.toContainText("Property 'toaster' does not exist");
});
