/** Monaco `.view-lines` text uses NBSP between tokens; normalize for assertions. */
export function normalizeMonacoText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
