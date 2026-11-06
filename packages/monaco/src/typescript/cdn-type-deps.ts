const TRIPLE_SLASH_PATH_PATTERN =
  /^\s*\/\/\/\s*<reference\s+path\s*=\s*["']([^"']+)["']/gm;
const TRIPLE_SLASH_TYPES_PATTERN =
  /^\s*\/\/\/\s*<reference\s+types\s*=\s*["']([^"']+)["']/gm;
const RELATIVE_SPECIFIER_PATTERN =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REFERENCE_DIRECTIVE_PATTERN = /^\/\/\/\s*<reference\b/;

/** Index just past the string or template literal opening at `start`. */
function findLiteralEnd(contents: string, start: number): number {
  const quote = contents[start];
  let index = start + 1;

  while (index < contents.length) {
    const char = contents[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === quote) {
      return index + 1;
    }

    if (char === "\n" && quote !== "`") {
      return index;
    }

    index++;
  }

  return contents.length;
}

/**
 * Removes comments so prose in JSDoc cannot read as a dependency, keeping
 * literals, line structure and line-leading `/// <reference>` directives.
 * Hand-written because this module ships in the options bundle, which must not
 * load the TypeScript compiler for `ts.preProcessFile`.
 */
function stripComments(contents: string): string {
  let output = "";
  let index = 0;
  let atLineStart = true;

  while (index < contents.length) {
    const char = contents[index];
    const next = contents[index + 1];

    if (char === '"' || char === "'" || char === "`") {
      const end = findLiteralEnd(contents, index);
      output += contents.slice(index, end);
      index = end;
      atLineStart = false;
      continue;
    }

    if (char === "/" && next === "*") {
      const close = contents.indexOf("*/", index + 2);
      const end = close === -1 ? contents.length : close + 2;
      output += contents.slice(index, end).replace(/[^\r\n]/g, " ");
      index = end;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = contents.indexOf("\n", index);
      const end = newline === -1 ? contents.length : newline;
      const line = contents.slice(index, end);

      if (atLineStart && REFERENCE_DIRECTIVE_PATTERN.test(line)) {
        output += line;
      }

      index = end;
      continue;
    }

    if (char === "\n") {
      atLineStart = true;
    } else if (char.trim()) {
      atLineStart = false;
    }

    output += char;
    index++;
  }

  return output;
}

/**
 * Resolves a relative path against a `.d.ts` file path inside an `@types`
 * package. Runtime extensions map to their declaration counterparts
 * (`.js` to `.d.ts`, `.mjs` to `.d.mts`, `.cjs` to `.d.cts`), and `.d.ts` is
 * appended when the specifier omits an extension.
 */
export function normalizeRelativePath(
  fromFile: string,
  relative: string
): string {
  const baseSegments = fromFile.split("/").slice(0, -1);
  const segments = relative.split("/");

  for (const segment of segments) {
    if (segment === "." || segment === "") {
      continue;
    }

    if (segment === "..") {
      baseSegments.pop();
      continue;
    }

    baseSegments.push(segment);
  }

  const path = baseSegments.join("/");

  if (/\.[cm]?ts$/.test(path)) {
    return path;
  }

  const runtimeExtension = /\.([cm]?)js$/.exec(path);

  return runtimeExtension
    ? `${path.slice(0, runtimeExtension.index)}.d.${runtimeExtension[1]}ts`
    : `${path}.d.ts`;
}

/**
 * Collects intra-package file references and transitive `@types` package names
 * from a single declaration file's contents.
 */
export function extractFileDependencies(
  filePath: string,
  contents: string
): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const code = stripComments(contents);

  for (const match of code.matchAll(TRIPLE_SLASH_PATH_PATTERN)) {
    files.add(normalizeRelativePath(filePath, match[1]));
  }

  for (const match of code.matchAll(TRIPLE_SLASH_TYPES_PATTERN)) {
    packages.add(match[1]);
  }

  for (const match of code.matchAll(RELATIVE_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2];

    if (specifier) {
      if (specifier.startsWith(".")) {
        files.add(normalizeRelativePath(filePath, specifier));
      } else {
        packages.add(specifier.startsWith("node:") ? "node" : specifier);
      }
    }
  }

  return { files: [...files], packages: [...packages] };
}
