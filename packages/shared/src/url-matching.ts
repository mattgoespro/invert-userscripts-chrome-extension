/**
 * Tests whether a URL matches any of the provided glob patterns.
 *
 * Patterns support `*` (matches any sequence of characters) and `?` (matches
 * a single character). All other regex-special characters are escaped.
 *
 * @param url - The full URL to test
 * @param patterns - An array of glob patterns to match against
 * @returns `true` if the URL matches at least one pattern
 */
export function matchesUrlPattern(url: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    // Convert glob pattern to regex with proper escaping
    // First escape all regex special characters except * and ?
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars including backslash
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, "."); // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  });
}
