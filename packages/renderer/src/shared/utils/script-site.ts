/** A short, scheme-free summary of a script's URL patterns for list rows. */
export function summarizeUrlPatterns(patterns: string[] | undefined): string {
  if (!patterns || patterns.length === 0) {
    return "No URL patterns";
  }

  const first = patterns[0].replace(/^(\*|https?):\/\//, "");
  return patterns.length > 1 ? `${first} +${patterns.length - 1}` : first;
}
