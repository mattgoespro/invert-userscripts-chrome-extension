import * as monaco from "monaco-editor";
import { SharedScriptInfo } from "@shared/model";

const SCRIPT_IMPORT_PATTERN =
  /import\s+(?:type\s+)?(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+["']scripts\/([^/"']+)\/(main|types)["']$/;
const SCRIPT_MODULE_PREFIX_PATTERN = /["']scripts\/([^/"']*)\/?$/;

/**
 * Registers Import Intelligence providers for shared scripts:
 * - Completion provider for `scripts/<module>/main|types` imports
 * - Hover provider showing exported members
 */
export function registerImportIntelligence(
  getSharedScripts: () => SharedScriptInfo[]
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  disposables.push(
    monaco.languages.registerCompletionItemProvider("typescript", {
      triggerCharacters: ["/", '"', "'"],
      provideCompletionItems(model, position) {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const importMatch = textUntilPosition.match(SCRIPT_IMPORT_PATTERN);

        if (!importMatch) {
          const modulePrefixMatch = textUntilPosition.match(
            SCRIPT_MODULE_PREFIX_PATTERN
          );

          if (modulePrefixMatch) {
            const partialModulePath = modulePrefixMatch[1];
            const sharedScripts = getSharedScripts();

            if (partialModulePath.includes("/")) {
              const [modulePath, partialEditor] = partialModulePath.split("/");
              const suggestions: monaco.languages.CompletionItem[] = ["main", "types"]
                .filter((editor) => editor.startsWith(partialEditor ?? ""))
                .map((editor) => ({
                  label: editor,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: textUntilPosition.length + 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                  kind: monaco.languages.CompletionItemKind.Module,
                  insertText: editor,
                  detail: `scripts/${modulePath}/${editor}`,
                }));

              return { suggestions };
            }

            const suggestions: monaco.languages.CompletionItem[] =
              sharedScripts
                .filter((script) =>
                  script.moduleName.startsWith(partialModulePath)
                )
                .flatMap((script) =>
                  (["main", "types"] as const).map((editor) => ({
                    label: `${script.moduleName}/${editor}`,
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: textUntilPosition.length + 1,
                      endLineNumber: position.lineNumber,
                      endColumn: position.column,
                    },
                    kind: monaco.languages.CompletionItemKind.Module,
                    insertText: `${script.moduleName}/${editor}`,
                    detail: script.name,
                    documentation: `Shared script: ${script.name}`,
                  }))
                );

            return { suggestions };
          }

          if (textUntilPosition.match(/["']scripts\/$/)) {
            const sharedScripts = getSharedScripts();
            const suggestions: monaco.languages.CompletionItem[] =
              sharedScripts.flatMap((script) =>
                (["main", "types"] as const).map((editor) => ({
                  label: `${script.moduleName}/${editor}`,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: textUntilPosition.length + 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                  kind: monaco.languages.CompletionItemKind.Module,
                  insertText: `${script.moduleName}/${editor}`,
                  detail: script.name,
                  documentation: `Shared script: ${script.name}`,
                }))
              );

            return { suggestions };
          }

          return { suggestions: [] };
        }

        const partialModulePath = importMatch[1];
        const sharedScripts = getSharedScripts();

        const suggestions: monaco.languages.CompletionItem[] = sharedScripts
          .filter((script) => script.moduleName.startsWith(partialModulePath))
          .flatMap((script) =>
            (["main", "types"] as const).map((editor) => ({
              label: `${script.moduleName}/${editor}`,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: textUntilPosition.length + 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: `${script.moduleName}/${editor}`,
              detail: script.name,
              documentation: `Shared script: ${script.name}`,
            }))
          );

        return { suggestions };
      },
    })
  );

  disposables.push(
    monaco.languages.registerCompletionItemProvider("typescript", {
      triggerCharacters: ["{", ",", " "],
      provideCompletionItems(model, position) {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const importMatch = textUntilPosition.match(SCRIPT_IMPORT_PATTERN);

        if (!importMatch) {
          const inBracesMatch = textUntilPosition.match(
            /import\s+(?:type\s+)?{([^}]*)$/
          );

          if (inBracesMatch) {
            const lineText = model.getLineContent(position.lineNumber);
            const moduleMatch =
              lineText.match(
                /from\s+["']scripts\/([^/"']+)\/(main|types)["']/
              ) ?? lineText.match(/from\s+["']shared\/([^"']+)["']/);

            if (!moduleMatch) {
              return { suggestions: [] };
            }

            const modulePath = moduleMatch[1];
            const sharedScripts = getSharedScripts();
            const script = sharedScripts.find(
              (entry) => entry.moduleName === modulePath
            );

            if (!script) {
              return { suggestions: [] };
            }

            const exports = extractExports(script, moduleMatch[2] === "types");
            const suggestions: monaco.languages.CompletionItem[] = exports.map(
              (exp) => ({
                label: exp.name,
                kind: getCompletionKind(exp.type),
                insertText: exp.name,
                detail: exp.type,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: textUntilPosition.length + 1,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              })
            );

            return { suggestions };
          }

          return { suggestions: [] };
        }

        const modulePath = importMatch[1];
        const sharedScripts = getSharedScripts();
        const script = sharedScripts.find(
          (entry) => entry.moduleName === modulePath
        );

        if (!script) {
          return { suggestions: [] };
        }

        const exports = extractExports(script, importMatch[2] === "types");
        const suggestions: monaco.languages.CompletionItem[] = exports.map(
          (exp) => ({
            label: exp.name,
            kind: getCompletionKind(exp.type),
            insertText: exp.name,
            detail: exp.type,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: textUntilPosition.length + 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          })
        );

        return { suggestions };
      },
    })
  );

  disposables.push(
    monaco.languages.registerHoverProvider("typescript", {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);

        if (!word) {
          return null;
        }

        const importMatch = model
          .getValue()
          .match(
            new RegExp(
              `import\\s+(?:type\\s+)?{[^}]*\\b${escapeRegExp(word.word)}\\b[^}]*}\\s+from\\s+["'](?:scripts\\/([^/"']+)\\/(main|types)|shared\\/([^"']+))["']`,
              "m"
            )
          );

        if (!importMatch) {
          return null;
        }

        const modulePath = importMatch[1] ?? importMatch[3];
        const sharedScripts = getSharedScripts();
        const script = sharedScripts.find(
          (entry) => entry.moduleName === modulePath
        );

        if (!script) {
          return null;
        }

        const exports = extractExports(script, importMatch[2] === "types");
        const exportInfo = exports.find((exp) => exp.name === word.word);

        if (!exportInfo) {
          return null;
        }

        const importPath = importMatch[1]
          ? `scripts/${importMatch[1]}/${importMatch[2]}`
          : `shared/${importMatch[3]}`;

        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            {
              value: `**${exportInfo.name}** (${exportInfo.type})`,
            },
            {
              value: `From shared script: \`${script.name}\` (\`${importPath}\`)`,
            },
          ],
        };
      },
    })
  );

  return disposables;
}

function extractExports(
  sharedScript: SharedScriptInfo,
  typesOnly: boolean
): Array<{ name: string; type: string }> {
  const exports = new Map<string, { name: string; type: string }>();

  if (!typesOnly) {
    collectSourceExports(exports, sharedScript.sourceCode);
  }

  collectTypeDefinitionExports(exports, sharedScript.typeDefinitions);

  return Array.from(exports.values());
}

function collectSourceExports(
  exports: Map<string, { name: string; type: string }>,
  sourceCode: string
): void {
  const functionMatches = sourceCode.matchAll(
    /export\s+(?:async\s+)?function\s+(\w+)/g
  );
  for (const match of functionMatches) {
    exports.set(match[1], { name: match[1], type: "function" });
  }

  const constMatches = sourceCode.matchAll(/export\s+const\s+(\w+)/g);
  for (const match of constMatches) {
    exports.set(match[1], { name: match[1], type: "const" });
  }

  const classMatches = sourceCode.matchAll(/export\s+class\s+(\w+)/g);
  for (const match of classMatches) {
    exports.set(match[1], { name: match[1], type: "class" });
  }

  const interfaceMatches = sourceCode.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    exports.set(match[1], { name: match[1], type: "interface" });
  }

  const typeMatches = sourceCode.matchAll(/export\s+type\s+(\w+)/g);
  for (const match of typeMatches) {
    exports.set(match[1], { name: match[1], type: "type" });
  }

  const enumMatches = sourceCode.matchAll(/export\s+enum\s+(\w+)/g);
  for (const match of enumMatches) {
    exports.set(match[1], { name: match[1], type: "enum" });
  }

  const namedExportMatches = sourceCode.matchAll(/export\s+{([^}]+)}/g);
  for (const match of namedExportMatches) {
    const names = match[1]
      .split(",")
      .map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1]?.trim() ?? "";
      })
      .filter(Boolean);
    for (const name of names) {
      exports.set(name, { name, type: "export" });
    }
  }
}

function collectTypeDefinitionExports(
  exports: Map<string, { name: string; type: string }>,
  typeDefinitions: string
): void {
  if (!typeDefinitions.trim()) {
    return;
  }

  addMatches(exports, typeDefinitions, /^\s*(?:declare\s+)?function\s+(\w+)/gm, "function");
  addMatches(exports, typeDefinitions, /^\s*(?:declare\s+)?(?:const|let|var)\s+(\w+)/gm, "const");
  addMatches(exports, typeDefinitions, /^\s*(?:declare\s+)?class\s+(\w+)/gm, "class");
  addMatches(exports, typeDefinitions, /^\s*interface\s+(\w+)/gm, "interface");
  addMatches(exports, typeDefinitions, /^\s*type\s+(\w+)/gm, "type");
  addMatches(exports, typeDefinitions, /^\s*(?:declare\s+)?enum\s+(\w+)/gm, "enum");
  addMatches(exports, typeDefinitions, /^\s*(?:declare\s+)?namespace\s+(\w+)/gm, "namespace");
}

function addMatches(
  exports: Map<string, { name: string; type: string }>,
  source: string,
  pattern: RegExp,
  type: string
): void {
  for (const match of source.matchAll(pattern)) {
    exports.set(match[1], { name: match[1], type });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCompletionKind(type: string): monaco.languages.CompletionItemKind {
  switch (type) {
    case "function":
      return monaco.languages.CompletionItemKind.Function;
    case "const":
      return monaco.languages.CompletionItemKind.Constant;
    case "class":
      return monaco.languages.CompletionItemKind.Class;
    case "interface":
      return monaco.languages.CompletionItemKind.Interface;
    case "type":
      return monaco.languages.CompletionItemKind.TypeParameter;
    default:
      return monaco.languages.CompletionItemKind.Variable;
  }
}
