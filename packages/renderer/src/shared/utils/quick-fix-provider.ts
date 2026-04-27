import * as monaco from "monaco-editor";
import { SharedScriptInfo } from "@shared/model";

/**
 * Registers a Code Action provider for TypeScript that provides Quick Fixes
 * for common errors and improvements.
 */
export function registerTypeScriptQuickFixProvider(
  getSharedScripts: () => SharedScriptInfo[]
): monaco.IDisposable {
  return monaco.languages.registerCodeActionProvider("typescript", {
    provideCodeActions(
      model,
      range,
      context
    ): monaco.languages.ProviderResult<monaco.languages.CodeActionList> {
      const actions: monaco.languages.CodeAction[] = [];

      // Get all markers (errors/warnings) in the current range
      const markers = context.markers;

      for (const marker of markers) {
        // Quick Fix: Auto-import shared scripts
        if (
          marker.code === "2304" || // Cannot find name
          marker.message.includes("Cannot find name")
        ) {
          const nameMatch = marker.message.match(/Cannot find name '(\w+)'/);
          if (nameMatch) {
            const missingName = nameMatch[1];
            const sharedScripts = getSharedScripts();

            // Check if any shared script exports this name
            for (const sharedScript of sharedScripts) {
              if (
                sharedScript.sourceCode.includes(`export ${missingName}`) ||
                sharedScript.sourceCode.includes(
                  `export function ${missingName}`
                ) ||
                sharedScript.sourceCode.includes(
                  `export const ${missingName}`
                ) ||
                sharedScript.sourceCode.includes(`export class ${missingName}`)
              ) {
                actions.push({
                  title: `Import '${missingName}' from "${sharedScript.moduleName}"`,
                  kind: "quickfix",
                  isPreferred: true,
                  edit: {
                    edits: [
                      {
                        resource: model.uri,
                        textEdit: {
                          range: {
                            startLineNumber: 1,
                            startColumn: 1,
                            endLineNumber: 1,
                            endColumn: 1,
                          },
                          text: `import { ${missingName} } from "shared/${sharedScript.moduleName}";\n`,
                        },
                        versionId: model.getVersionId(),
                      },
                    ],
                  },
                  diagnostics: [marker],
                });
              }
            }
          }
        }

        // Quick Fix: Add missing type annotations
        if (
          marker.code === "7006" || // Parameter implicitly has an 'any' type
          marker.message.includes("implicitly has an 'any' type")
        ) {
          const line = model.getLineContent(marker.startLineNumber);
          const paramMatch = line.match(/(\w+)\s*[,)]/);

          if (paramMatch) {
            const paramName = paramMatch[1];

            actions.push({
              title: `Add type annotation to '${paramName}'`,
              kind: "quickfix",
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: {
                        startLineNumber: marker.startLineNumber,
                        startColumn: marker.startColumn + paramName.length,
                        endLineNumber: marker.endLineNumber,
                        endColumn: marker.startColumn + paramName.length,
                      },
                      text: ": any",
                    },
                    versionId: model.getVersionId(),
                  },
                ],
              },
              diagnostics: [marker],
            });
          }
        }

        // Quick Fix: Wrap in try-catch
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

        // Quick Fix: Generate JSDoc
        if (marker.startLineNumber > 1) {
          const prevLine = model.getLineContent(marker.startLineNumber - 1);
          const currentLine = model.getLineContent(marker.startLineNumber);

          if (
            (currentLine.includes("function ") ||
              (currentLine.includes("const ") && currentLine.includes("=>"))) &&
            !prevLine.includes("/**")
          ) {
            const indent = currentLine.match(/^\s*/)?.[0] || "";
            const functionMatch =
              currentLine.match(/function\s+(\w+)\s*\(([^)]*)\)/) ||
              currentLine.match(
                /(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/
              );

            if (functionMatch) {
              const functionName = functionMatch[1];
              const params = functionMatch[2]
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);

              let jsdoc = `${indent}/**\n${indent} * Description of ${functionName}\n`;

              for (const param of params) {
                const paramName = param.split(":")[0].trim();
                jsdoc += `${indent} * @param ${paramName} \n`;
              }

              jsdoc += `${indent} */\n`;

              actions.push({
                title: "Generate JSDoc comment",
                kind: "refactor",
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
                        text: jsdoc,
                      },
                      versionId: model.getVersionId(),
                    },
                  ],
                },
                diagnostics: [marker],
              });
            }
          }
        }
      }

      // Additional code actions (not tied to specific markers)

      // Refactor: Extract to shared script
      if (!range.isEmpty()) {
        const selectedText = model.getValueInRange(range);

        actions.push({
          title: "Extract to shared script",
          kind: "refactor.extract",
          edit: {
            edits: [
              {
                resource: model.uri,
                textEdit: {
                  range,
                  text: `// TODO: Move this to a shared script and import it\n${selectedText}`,
                },
                versionId: model.getVersionId(),
              },
            ],
          },
        });
      }

      return {
        actions,
        dispose: () => {},
      };
    },
  });
}
