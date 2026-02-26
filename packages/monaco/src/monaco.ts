import { applyHighlighter } from "./theming";

// Cached initialization promise — ensures `registerMonaco()` only runs once and all callers await the same result.
let initPromise: Promise<void> | null = null;

/**
 * Initialize Shiki's TextMate tokenizer and wire it into Monaco.
 * Safe to call multiple times — subsequent calls return the same promise.
 * Must be awaited BEFORE creating any Monaco editor instances so that:
 * 1. Monarch tokenizers are blocked for Shiki-managed languages
 * 2. shikiToMonaco's monkey-patches of editor.create / editor.setTheme are installed
 * 3. Themes are defined and token providers are registered
 */
export function registerMonaco(): Promise<void> {
  if (!initPromise) {
    initPromise = applyHighlighter();
  }

  return initPromise;
}
