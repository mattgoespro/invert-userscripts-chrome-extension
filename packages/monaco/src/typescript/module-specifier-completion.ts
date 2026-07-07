import * as monaco from "monaco-editor";

/**
 * Completion for `"scripts/<module>/<main|types>"` import specifiers.
 *
 * This is the single piece of import intellisense the TypeScript worker cannot
 * provide natively: Monaco's worker host implements neither `readDirectory`
 * nor `getDirectories`, so the language service cannot enumerate `paths`
 * pattern matches inside string literals (verified by the Phase 0 spike in
 * tests/monaco-worker-vfs.test.mjs). Everything else — named-import member
 * completion, hover, auto-import, diagnostics — comes from the worker against
 * the real script models.
 *
 * The provider is purely data-driven: it renders whatever the supplied getter
 * returns and contains no source-code analysis.
 */

export interface SharedModuleSpecifierInfo {
  moduleName: string;
  scriptName: string;
}

const SPECIFIER_PREFIX_PATTERN =
  /(?:import|export)\s[^\n]*?from\s*["']scripts\/([\w./-]*)$|import\s*\(\s*["']scripts\/([\w./-]*)$/;

export function registerModuleSpecifierCompletion(
  getSharedModules: () => SharedModuleSpecifierInfo[]
): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("typescript", {
    triggerCharacters: ["/", '"', "'"],
    provideCompletionItems(model, position) {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const match = textUntilPosition.match(SPECIFIER_PREFIX_PATTERN);

      if (!match) {
        return { suggestions: [] };
      }

      const typedPath = match[1] ?? match[2] ?? "";
      const word = model.getWordUntilPosition(position);
      const replaceRange = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        position.column
      );

      // After a complete module segment, offer the entry points.
      const segmentEnd = typedPath.indexOf("/");

      if (segmentEnd !== -1) {
        const moduleName = typedPath.slice(0, segmentEnd);
        const known = getSharedModules().some(
          (info) => info.moduleName === moduleName
        );

        if (!known) {
          return { suggestions: [] };
        }

        return {
          suggestions: (["main", "types"] as const).map((entry) => ({
            label: entry,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: entry,
            range: replaceRange,
            detail: `scripts/${moduleName}/${entry}`,
          })),
        };
      }

      return {
        suggestions: getSharedModules().flatMap((info) =>
          (["main", "types"] as const).map((entry) => ({
            label: `${info.moduleName}/${entry}`,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `${info.moduleName}/${entry}`,
            range: replaceRange,
            detail: info.scriptName,
            documentation: `Shared script: ${info.scriptName}`,
          }))
        ),
      };
    },
  });
}
