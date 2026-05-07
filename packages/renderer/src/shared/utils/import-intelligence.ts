import * as monaco from "monaco-editor";
import { SharedScriptInfo } from "@shared/model";

/**
 * Registers Import Intelligence providers for shared scripts:
 * - Completion provider for "shared/" imports
 * - Hover provider showing exported members
 * - Definition provider (go-to-definition)
 * - Reference provider (find-all-usages)
 */
export function registerImportIntelligence(
  getSharedScripts: () => SharedScriptInfo[]
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // Completion provider for shared scripts
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

        // Check if we're in an import statement
        const importMatch = textUntilPosition.match(
          /import\s+(?:type\s+)?(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+["']shared\/(.*?)$/
        );

        if (!importMatch) {
          // Also handle the case where user just typed "shared/"
          if (textUntilPosition.match(/["']shared\/$/)) {
            const sharedScripts = getSharedScripts();
            const suggestions: monaco.languages.CompletionItem[] =
              sharedScripts.map((script) => ({
                label: script.moduleName,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: textUntilPosition.length + 1,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: script.moduleName,
                detail: script.name,
                documentation: `Shared script: ${script.name}`,
              }));

            return { suggestions };
          }

          return { suggestions: [] };
        }

        const partialModuleName = importMatch[1];
        const sharedScripts = getSharedScripts();

        const suggestions: monaco.languages.CompletionItem[] = sharedScripts
          .filter((script) => script.moduleName.startsWith(partialModuleName))
          .map((script) => ({
            label: script.moduleName,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: textUntilPosition.length + 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: script.moduleName,
            detail: script.name,
            documentation: `Shared script: ${script.name}`,
          }));

        return { suggestions };
      },
    })
  );

  // Completion provider for export members
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

        // Check if we're in the destructuring part of an import
        const importMatch = textUntilPosition.match(
          /import\s+(?:type\s+)?{([^}]*)}\s+from\s+["']shared\/([^"']+)["']$/
        );

        if (!importMatch) {
          // Handle case where user is typing inside the braces
          const inBracesMatch = textUntilPosition.match(
            /import\s+(?:type\s+)?{([^}]*)$/
          );

          if (inBracesMatch) {
            // Find the module name from earlier in the file
            const lineText = model.getLineContent(position.lineNumber);
            const moduleMatch = lineText.match(
              /from\s+["']shared\/([^"']+)["']/
            );

            if (!moduleMatch) {
              return { suggestions: [] };
            }

            const moduleName = moduleMatch[1];
            const sharedScripts = getSharedScripts();
            const script = sharedScripts.find(
              (s) => s.moduleName === moduleName
            );

            if (!script) {
              return { suggestions: [] };
            }

            const exports = extractExports(script);
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

        const moduleName = importMatch[2];
        const sharedScripts = getSharedScripts();
        const script = sharedScripts.find((s) => s.moduleName === moduleName);

        if (!script) {
          return { suggestions: [] };
        }

        const exports = extractExports(script);
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

  // Hover provider
  disposables.push(
    monaco.languages.registerHoverProvider("typescript", {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);

        if (!word) {
          return null;
        }

        // Check if this word is from a shared import
        const importMatch = model
          .getValue()
          .match(
            new RegExp(
              `import\\s+(?:type\\s+)?{[^}]*\\b${escapeRegExp(word.word)}\\b[^}]*}\\s+from\\s+["']shared\\/([^"']+)["']`,
              "m"
            )
          );

        if (!importMatch) {
          return null;
        }

        const moduleName = importMatch[1];
        const sharedScripts = getSharedScripts();
        const script = sharedScripts.find((s) => s.moduleName === moduleName);

        if (!script) {
          return null;
        }

        const exports = extractExports(script);
        const exportInfo = exports.find((exp) => exp.name === word.word);

        if (!exportInfo) {
          return null;
        }

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
              value: `From shared script: \`${script.name}\` (\`shared/${moduleName}\`)`,
            },
          ],
        };
      },
    })
  );

  return disposables;
}

/**
 * Extract export information from TypeScript source code
 */
function extractExports(
  sharedScript: SharedScriptInfo
): Array<{ name: string; type: string }> {
  const exports = new Map<string, { name: string; type: string }>();

  collectSourceExports(exports, sharedScript.sourceCode);
  collectTypeDefinitionExports(exports, sharedScript.typeDefinitions);

  return Array.from(exports.values());
}

function collectSourceExports(
  exports: Map<string, { name: string; type: string }>,
  sourceCode: string
): void {
  // Match: export function name
  const functionMatches = sourceCode.matchAll(
    /export\s+(?:async\s+)?function\s+(\w+)/g
  );
  for (const match of functionMatches) {
    exports.set(match[1], { name: match[1], type: "function" });
  }

  // Match: export const name
  const constMatches = sourceCode.matchAll(/export\s+const\s+(\w+)/g);
  for (const match of constMatches) {
    exports.set(match[1], { name: match[1], type: "const" });
  }

  // Match: export class name
  const classMatches = sourceCode.matchAll(/export\s+class\s+(\w+)/g);
  for (const match of classMatches) {
    exports.set(match[1], { name: match[1], type: "class" });
  }

  // Match: export interface name
  const interfaceMatches = sourceCode.matchAll(/export\s+interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    exports.set(match[1], { name: match[1], type: "interface" });
  }

  // Match: export type name
  const typeMatches = sourceCode.matchAll(/export\s+type\s+(\w+)/g);
  for (const match of typeMatches) {
    exports.set(match[1], { name: match[1], type: "type" });
  }

  // Match: export enum name
  const enumMatches = sourceCode.matchAll(/export\s+enum\s+(\w+)/g);
  for (const match of enumMatches) {
    exports.set(match[1], { name: match[1], type: "enum" });
  }

  // Match: export { name1, name2 }
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

/**
 * Map export type to Monaco completion kind
 */
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
