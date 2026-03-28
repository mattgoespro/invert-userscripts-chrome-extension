import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { shikiToMonaco } from "@shikijs/monaco";
import monaco from "monaco-editor";
import { EditorDefaultTheme, EditorThemes } from "./theming";

/**
 * Languages managed by Shiki's TextMate tokenizer.
 * Monarch tokenizers are blocked for these languages in `registerMonaco()` so that Shiki
 * is the sole provider of syntax highlighting for them. All other languages continue to use Monarch.
 */
const SHIKI_LANGUAGES = new Set(["typescript", "javascript", "scss", "css"]);

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
export async function registerMonaco(): Promise<void> {
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
  monaco.editor.setTheme(EditorDefaultTheme);
}
