import type { CompilationError } from "@shared/errors";

export type DiagnosticError = Omit<CompilationError, "id" | "timestamp">;

/** Compare visible diagnostics without their generated identity or timestamp. */
export function areScriptErrorsEqual(
  previous: readonly DiagnosticError[] = [],
  next: readonly DiagnosticError[] = []
): boolean {
  return (
    previous.length === next.length &&
    previous.every((error, index) => {
      const other = next[index];
      return (
        error.scriptId === other.scriptId &&
        error.language === other.language &&
        error.message === other.message &&
        error.code === other.code &&
        error.severity === other.severity &&
        error.line === other.line &&
        error.column === other.column &&
        error.endLine === other.endLine &&
        error.endColumn === other.endColumn
      );
    })
  );
}
