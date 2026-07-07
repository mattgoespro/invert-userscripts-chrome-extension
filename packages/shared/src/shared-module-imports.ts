/**
 * Lightweight shared-module import discovery for the main thread.
 *
 * Parses `scripts/<module>/main` runtime import specifiers without pulling the
 * TypeScript compiler into the options bundle. The build worker uses the full
 * AST-based collector in `compiled-output.ts` during compilation.
 */

const SCRIPTS_MAIN_SPECIFIER =
  /^\s*(?:import|export)(?![\s\S]*\btype\s+only\b)(?!\s*type\b)[^\n]*?\bfrom\s*["']scripts\/([^/"']+)\/main["']/gm;

const SIDE_EFFECT_MAIN_SPECIFIER =
  /^\s*import\s*["']scripts\/([^/"']+)\/main["']\s*;?/gm;

const DYNAMIC_MAIN_SPECIFIER =
  /import\s*\(\s*["']scripts\/([^/"']+)\/main["']\s*\)/g;

function collectFromPattern(sourceCode: string, pattern: RegExp): string[] {
  const names = new Set<string>();

  for (const match of sourceCode.matchAll(pattern)) {
    const name = match[1];

    if (name) {
      names.add(name);
    }
  }

  return [...names];
}

/** Returns module path segments for runtime shared-script dependencies. */
export function getSharedImportModuleNames(sourceCode: string): string[] {
  const names = new Set<string>([
    ...collectFromPattern(sourceCode, SCRIPTS_MAIN_SPECIFIER),
    ...collectFromPattern(sourceCode, SIDE_EFFECT_MAIN_SPECIFIER),
    ...collectFromPattern(sourceCode, DYNAMIC_MAIN_SPECIFIER),
  ]);

  return [...names];
}
