import * as monaco from "monaco-editor";
import { getTypeScriptWorkerAccessor } from "@packages/monaco";

/**
 * Bespoke code actions that complement the TypeScript language service.
 *
 * Auto-import, "cannot find name" fixes, and implicit-any parameter fixes are
 * intentionally NOT provided here: with every script mounted as a real model
 * in the TypeScript program, the language service's own code fixes handle
 * those (with correct specifiers and types). This provider only adds actions
 * the service does not offer, built on the worker's navigation tree rather
 * than line-content regex.
 */
export function registerBespokeCodeActions(): monaco.IDisposable {
  return monaco.languages.registerCodeActionProvider("typescript", {
    async provideCodeActions(
      model,
      range,
      context
    ): Promise<monaco.languages.CodeActionList> {
      const actions: monaco.languages.CodeAction[] = [];

      for (const marker of context.markers) {
        // Wrap in try-catch for async/Promise-related errors.
        if (
          marker.severity === monaco.MarkerSeverity.Error &&
          (marker.message.includes("await") ||
            marker.message.includes("Promise"))
        ) {
          const lineContent = model.getLineContent(marker.startLineNumber);
          const indent = lineContent.match(/^\s*/)?.[0] || "";

          actions.push({
            title: "Wrap in try-catch block",
            kind: "quickfix",
            edit: {
              edits: [
                {
                  resource: model.uri,
                  textEdit: {
                    range: {
                      startLineNumber: marker.startLineNumber,
                      startColumn: 1,
                      endLineNumber: marker.startLineNumber,
                      endColumn: 1,
                    },
                    text: `${indent}try {\n`,
                  },
                  versionId: model.getVersionId(),
                },
                {
                  resource: model.uri,
                  textEdit: {
                    range: {
                      startLineNumber: marker.endLineNumber,
                      startColumn:
                        model.getLineContent(marker.endLineNumber).length + 1,
                      endLineNumber: marker.endLineNumber,
                      endColumn:
                        model.getLineContent(marker.endLineNumber).length + 1,
                    },
                    text: `\n${indent}} catch (error) {\n${indent}  console.error(error);\n${indent}}`,
                  },
                  versionId: model.getVersionId(),
                },
              ],
            },
            diagnostics: [marker],
          });
        }
      }

      // Generate JSDoc for the function at the cursor, located via the
      // TypeScript worker's navigation tree instead of line regex.
      const jsdocAction = await buildJsdocAction(model, range);

      if (jsdocAction) {
        actions.push(jsdocAction);
      }

      return {
        actions,
        dispose: () => {},
      };
    },
  });
}

interface NavigationTreeNode {
  text: string;
  kind: string;
  spans: Array<{ start: number; length: number }>;
  childItems?: NavigationTreeNode[];
}

const FUNCTION_NAVIGATION_KINDS = new Set(["function", "method"]);

function findFunctionAtOffset(
  node: NavigationTreeNode,
  offset: number
): NavigationTreeNode | null {
  for (const child of node.childItems ?? []) {
    const inChild = child.spans.some(
      (span) => offset >= span.start && offset <= span.start + span.length
    );

    if (!inChild) {
      continue;
    }

    return (
      findFunctionAtOffset(child, offset) ??
      (FUNCTION_NAVIGATION_KINDS.has(child.kind) ? child : null)
    );
  }

  return null;
}

async function buildJsdocAction(
  model: monaco.editor.ITextModel,
  range: monaco.Range
): Promise<monaco.languages.CodeAction | null> {
  try {
    const workerFactory = await getTypeScriptWorkerAccessor();
    const worker = await workerFactory(model.uri);

    if (model.isDisposed()) {
      return null;
    }

    const tree = (await worker.getNavigationTree(
      model.uri.toString()
    )) as NavigationTreeNode | null;

    if (!tree || model.isDisposed()) {
      return null;
    }

    const offset = model.getOffsetAt({
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    });
    const fn = findFunctionAtOffset(tree, offset);

    if (!fn) {
      return null;
    }

    const span = fn.spans[0];
    const startPosition = model.getPositionAt(span.start);
    const previousLine =
      startPosition.lineNumber > 1
        ? model.getLineContent(startPosition.lineNumber - 1)
        : "";

    if (previousLine.includes("*/") || previousLine.includes("/**")) {
      return null;
    }

    const signatureText = model.getValueInRange({
      startLineNumber: startPosition.lineNumber,
      startColumn: 1,
      endLineNumber: model.getPositionAt(span.start + span.length).lineNumber,
      endColumn: 1,
    });
    const paramsMatch = signatureText.match(/\(([^)]*)\)/);
    const params = (paramsMatch?.[1] ?? "")
      .split(",")
      .map((param) =>
        param
          .split(":")[0]
          .trim()
          .replace(/^\.{3}/, "")
      )
      .filter((name) => name && /^\w+$/.test(name));

    const indent =
      model.getLineContent(startPosition.lineNumber).match(/^\s*/)?.[0] ?? "";
    const lines = [
      `${indent}/**`,
      `${indent} * Description of ${fn.text}`,
      ...params.map((param) => `${indent} * @param ${param} `),
      `${indent} */`,
      "",
    ];

    return {
      title: `Generate JSDoc for '${fn.text}'`,
      kind: "refactor",
      edit: {
        edits: [
          {
            resource: model.uri,
            textEdit: {
              range: {
                startLineNumber: startPosition.lineNumber,
                startColumn: 1,
                endLineNumber: startPosition.lineNumber,
                endColumn: 1,
              },
              text: lines.join("\n"),
            },
            versionId: model.getVersionId(),
          },
        ],
      },
    };
  } catch {
    return null;
  }
}
