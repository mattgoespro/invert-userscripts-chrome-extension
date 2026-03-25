import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { shikiToMonaco } from "@shikijs/monaco";
import monaco from "monaco-editor";
import { DEFAULT_THEME, EditorThemes } from "./theming";

/** Languages managed by Shiki's TextMate tokenizer. */
const SHIKI_LANGUAGES = new Set(["typescript", "javascript", "scss", "css"]);

// ── Public API ────────────────────────────────────────────────────────────────

// Cached initialization promise — ensures `registerMonaco()` only runs once and all callers await the same result.
let initPromise: Promise<void> | null = null;

/**
 * Initialize Shiki's TextMate tokenizer and wire it into Monaco.
 * Safe to call multiple times — subsequent calls return the same promise.
 * Must be awaited BEFORE creating any Monaco editor instances so that:
 * 1. Monarch tokenizers are blocked for Shiki-managed languages
 * 2. Monkey-patches on `editor.create` / `editor.setTheme` are installed
 * 3. All themes are defined and token providers are registered
 */
export function registerMonaco(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeShiki();
  }
  return initPromise;
}

/**
 * Initializes Shiki's TextMate tokenizer and wires it into Monaco via `shikiToMonaco`.
 *
 * All themes are pre-loaded at initialization so `shikiToMonaco` can register them with Monaco
 * upfront — eliminating the need for lazy theme loading and custom monkey-patches.
 *
 * Performance optimizations:
 * 1. **JavaScript regex engine** instead of Oniguruma WASM — eliminates WASM download,
 *    compilation, and instantiation. The JS engine is synchronous and creates regexes lazily.
 * 2. **`tokenizeTimeLimit: 0`** — disables the per-line timeout. The default 500ms timeout
 *    causes vscode-textmate to return a corrupted mid-parse ruleStack when exceeded, cascading
 *    to all subsequent lines losing syntax highlighting.
 */
async function initializeShiki(): Promise<void> {
  const highlighter = await createHighlighterCore({
    themes: Object.values(EditorThemes),
    langs: [
      import("@shikijs/langs/ts"),
      import("@shikijs/langs/js"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/scss"),
    ],
    engine: createJavaScriptRegexEngine(),
  });

  // Block Monarch tokenizers for Shiki-managed languages. Done AFTER the highlighter is
  // successfully created so that if Shiki initialization fails, Monarch remains as a fallback.
  const _setMonarch = monaco.languages.setMonarchTokensProvider.bind(
    monaco.languages
  );
  monaco.languages.setMonarchTokensProvider = (languageId, languageDef) => {
    if (SHIKI_LANGUAGES.has(languageId)) {
      return { dispose() {} };
    }
    return _setMonarch(languageId, languageDef);
  };

  // Wire Shiki into Monaco: registers all themes, installs setTheme/create monkey-patches,
  // and sets up TextMate token providers for each loaded language.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shikiToMonaco(highlighter, monaco as any, { tokenizeTimeLimit: 0 });

  // Apply the project's default theme (shikiToMonaco defaults to the first loaded theme).
  monaco.editor.setTheme(DEFAULT_THEME);
}
