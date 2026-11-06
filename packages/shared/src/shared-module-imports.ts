/**
 * Lightweight shared-module import discovery for the main thread.
 *
 * Parses `scripts/<module>/main` runtime import specifiers without pulling the
 * TypeScript compiler into the options bundle. The build worker uses the full
 * AST-based collector in `compiled-output.ts` during compilation.
 */

/**
 * Matches the import/export clause grammar rather than "anything up to `from`",
 * so clauses may span lines without running into a neighbouring statement.
 * `import type from "x"` and `import type, { y } from "x"` bind a value named `type`.
 */
const SCRIPTS_MAIN_SPECIFIER =
  /(?:^|;)\s*(?:import\b(?!\s*type\b(?!\s*(?:from\s*["']|,)))\s*(?:[^\s,{}*"';]+\s*,?\s*)?(?:\*\s*as\s+[^\s,{}*"';]+\s*|\{[^{}]*\}\s*)?|export\s*(?:\*\s*(?:as\s+[^\s,{}*"';]+\s*)?|\{[^{}]*\}\s*))from\s*["']scripts\/([^/"']+)\/main["']/gm;

const SIDE_EFFECT_MAIN_SPECIFIER =
  /^\s*import\s*["']scripts\/([^/"']+)\/main["']\s*;?/gm;

const DYNAMIC_MAIN_SPECIFIER =
  /import\s*\(\s*["']scripts\/([^/"']+)\/main["']\s*\)/g;

/** Tokens after which a `/` starts a regular expression rather than a division. */
const REGEX_PRECEDING_TOKEN = /[(,=:[!&|?{};+\-*%<>~^}]/;

function skipQuoted(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
    } else if (char === quote) {
      return index + 1;
    } else if (char === "\n" && quote !== "`") {
      return index;
    } else {
      index++;
    }
  }

  return source.length;
}

/** Returns the end of the regular expression at `start`, or -1 if it is not one. */
function skipRegex(source: string, start: number): number {
  let inClass = false;
  let index = start + 1;

  while (index < source.length && source[index] !== "\n") {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === "/" && !inClass) {
      return index + 1;
    }

    if (char === "[") {
      inClass = true;
    } else if (char === "]") {
      inClass = false;
    }

    index++;
  }

  return -1;
}

/** Removes comments while leaving strings, templates and regular expressions intact. */
function stripComments(source: string): string {
  let output = "";
  let index = 0;
  let previousToken = "";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      output += " ";
      continue;
    }

    let end = -1;

    if (char === '"' || char === "'" || char === "`") {
      end = skipQuoted(source, index);
    } else if (
      char === "/" &&
      (!previousToken || REGEX_PRECEDING_TOKEN.test(previousToken))
    ) {
      end = skipRegex(source, index);
    }

    if (end !== -1) {
      output += source.slice(index, end);
      previousToken = source[end - 1];
      index = end;
      continue;
    }

    output += char;
    if (!/\s/.test(char)) {
      previousToken = char;
    }
    index++;
  }

  return output;
}

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
  const code = stripComments(sourceCode);
  const names = new Set<string>([
    ...collectFromPattern(code, SCRIPTS_MAIN_SPECIFIER),
    ...collectFromPattern(code, SIDE_EFFECT_MAIN_SPECIFIER),
    ...collectFromPattern(code, DYNAMIC_MAIN_SPECIFIER),
  ]);

  return [...names];
}
