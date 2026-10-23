/**
 * Regex for a valid HTTP/HTTPS URL glob pattern.
 * Supports `*` and `?` glob wildcards in host, port, and path segments.
 *
 * Structure: scheme://host[:port][/path]
 * - Scheme: `http`, `https`, or `*`
 * - Host: `*`, `localhost`, or a dotted domain (each label: alphanumeric/glob, no leading/trailing hyphens)
 * - Port: optional, digits or glob wildcards
 * - Path: optional, any non-whitespace
 */
const URL_GLOB_PATTERN =
  /^(\*|https?):\/\/(\*|localhost|(?:[a-zA-Z0-9*?](?:[a-zA-Z0-9\-*?]*[a-zA-Z0-9*?])?\.)+[a-zA-Z0-9*?](?:[a-zA-Z0-9\-*?]*[a-zA-Z0-9*?])?)(?::[0-9*?]+)?(?:\/\S*)?$/;

/**
 * Validates that a glob pattern is a valid HTTP/HTTPS URL glob expression.
 * Mirrors the conversion logic in `packages/runtime/src/ide/scripts.ts`.
 */
export function isValidUrlPattern(pattern: string): boolean {
  return URL_GLOB_PATTERN.test(pattern);
}

/** Splits pasted text into candidate patterns (comma or newline separated). */
export function parseUrlPatternInput(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}
