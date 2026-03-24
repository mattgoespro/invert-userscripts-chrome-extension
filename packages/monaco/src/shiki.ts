import { createHighlighterCore, type HighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { textmateThemeToMonacoTheme } from "@shikijs/monaco";
import {
  EncodedTokenMetadata,
  FontStyle,
  INITIAL,
  type StateStack,
} from "@shikijs/vscode-textmate";
import monaco from "monaco-editor";
import { DEFAULT_THEME, EditorThemes, type EditorThemeName } from "./theming";

// ── Module State ──────────────────────────────────────────────────────────────

let highlighter: HighlighterCore | null = null;

/** Color map shared between theme switching and the tokenizer. Updated on each theme change. */
const colorMap: string[] = [];

/**
 * Maps "normalizedColor|fontStyle" keys to TextMate scope strings. Used by the tokenizer for
 * reverse color→scope lookup. Rebuilt on each theme change.
 */
const colorStyleToScopeMap = new Map<string, string>();

/** Monaco theme definitions for themes that have been loaded into the highlighter. */
const monacoThemeMap = new Map<string, monaco.editor.IStandaloneThemeData>();

// ── Color & Font Style Utilities ──────────────────────────────────────────────
// Adapted from @shikijs/monaco's internal helpers.

function normalizeColor(
  color: string | string[] | undefined
): string | undefined {
  if (Array.isArray(color)) color = color[0];
  if (!color) return undefined;
  color = (color.charCodeAt(0) === 35 ? color.slice(1) : color).toLowerCase();
  if (color.length === 3 || color.length === 4)
    color = color
      .split("")
      .map((c) => c + c)
      .join("");
  return color;
}

const VALID_FONT_STYLES = ["italic", "bold", "underline", "strikethrough"];
const VALID_FONT_ALIASES: Record<string, string> = {
  "line-through": "strikethrough",
};

function normalizeFontStyleString(fontStyle: string | undefined): string {
  if (!fontStyle) return "";
  const styles = new Set(
    fontStyle
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .map((s) => VALID_FONT_ALIASES[s] || s)
      .filter(Boolean)
  );
  return VALID_FONT_STYLES.filter((s) => styles.has(s)).join(" ");
}

function normalizeFontStyleBits(fontStyle: number): string {
  if (fontStyle <= FontStyle.None) return "";
  const styles: string[] = [];
  if (fontStyle & FontStyle.Italic) styles.push("italic");
  if (fontStyle & FontStyle.Bold) styles.push("bold");
  if (fontStyle & FontStyle.Underline) styles.push("underline");
  if (fontStyle & FontStyle.Strikethrough) styles.push("strikethrough");
  return styles.join(" ");
}

function getColorStyleKey(color: string, fontStyle: string): string {
  return fontStyle ? `${color}|${fontStyle}` : color;
}

function findScopeByColorAndStyle(
  color: string,
  fontStyle: number
): string | undefined {
  return colorStyleToScopeMap.get(
    getColorStyleKey(color, normalizeFontStyleBits(fontStyle))
  );
}

// ── TokenizerState ────────────────────────────────────────────────────────────

class TokenizerState implements monaco.languages.IState {
  constructor(readonly ruleStack: StateStack) {}

  clone(): TokenizerState {
    return new TokenizerState(this.ruleStack);
  }

  equals(other: monaco.languages.IState): boolean {
    return (
      other instanceof TokenizerState &&
      other === this &&
      other.ruleStack === this.ruleStack
    );
  }
}

// ── Theme Loading ─────────────────────────────────────────────────────────────

/**
 * Ensures a theme is loaded into the Shiki highlighter and defined with Monaco.
 * No-op if the theme is already loaded or the theme ID is unrecognized.
 */
function ensureThemeLoaded(themeId: string): void {
  if (!highlighter) return;
  if (highlighter.getLoadedThemes().includes(themeId)) return;

  const themeData = EditorThemes[themeId as EditorThemeName];
  if (!themeData) return;

  highlighter.loadThemeSync(themeData);

  const tmTheme = highlighter.getTheme(themeId);
  const monacoTheme = textmateThemeToMonacoTheme(tmTheme);
  monacoThemeMap.set(themeId, monacoTheme);
  monaco.editor.defineTheme(themeId, monacoTheme);
}

/**
 * Updates the shared colorMap and colorStyleToScopeMap for the given theme. Called on every theme
 * switch so the tokenizer's reverse color→scope lookup stays in sync with the active theme.
 */
function applyThemeColorMap(themeId: string): void {
  if (!highlighter) return;

  const ret = highlighter.setTheme(themeId);
  const theme = monacoThemeMap.get(themeId);

  colorMap.length = ret.colorMap.length;
  for (let i = 0; i < ret.colorMap.length; i++) {
    colorMap[i] = ret.colorMap[i];
  }

  colorStyleToScopeMap.clear();
  theme?.rules?.forEach((rule) => {
    const c = normalizeColor(rule.foreground);
    if (!c) return;
    const key = getColorStyleKey(c, normalizeFontStyleString(rule.fontStyle));
    if (!colorStyleToScopeMap.has(key))
      colorStyleToScopeMap.set(key, rule.token);
  });
}

// ── Monaco Integration ────────────────────────────────────────────────────────

/** Languages managed by Shiki's TextMate tokenizer. */
const SHIKI_LANGUAGES = ["typescript", "javascript", "scss", "css"] as const;

/**
 * Installs the Shiki TextMate tokenizer into Monaco with support for lazy theme loading. This
 * replaces `shikiToMonaco` from `@shikijs/monaco` with a custom integration that loads themes
 * on demand instead of requiring all themes at initialization.
 *
 * Monkey-patches:
 * - `monaco.languages.setMonarchTokensProvider` — blocks Monarch for Shiki-managed languages
 * - `monaco.editor.setTheme` — lazy-loads themes and updates shared color/scope maps
 * - `monaco.editor.create` — triggers theme setup on editor creation
 *
 * Registers `setTokensProvider` for each loaded language so Monaco uses Shiki's TextMate grammars
 * instead of Monarch for tokenization. Monaco's language service workers (LSP) remain active for
 * intellisense, diagnostics, and completions — Shiki only replaces the tokenization layer.
 */
function installMonacoIntegration(): void {
  if (!highlighter) throw new Error("Highlighter not initialized");

  const _highlighter = highlighter;
  const shikiLanguageSet = new Set<string>(SHIKI_LANGUAGES);

  /**
   * Block Monarch tokenizers for Shiki-managed languages. Done AFTER the highlighter is
   * successfully created so that if Shiki initialization fails, Monarch remains as a fallback.
   */
  const _setMonarch = monaco.languages.setMonarchTokensProvider.bind(
    monaco.languages
  );
  monaco.languages.setMonarchTokensProvider = (languageId, languageDef) => {
    if (shikiLanguageSet.has(languageId)) {
      console.log(
        `Monarch token provider registration blocked for language "${languageId}" because it's managed by Shiki's TextMate tokenizer.`
      );
      return { dispose: () => {} };
    }
    return _setMonarch(languageId, languageDef);
  };

  // Register language IDs with Monaco so setTokensProvider calls succeed.
  for (const lang of SHIKI_LANGUAGES) {
    monaco.languages.register({ id: lang });
  }

  /**
   * Monkey-patch setTheme to transparently handle lazy theme loading. When a theme is requested
   * that hasn't been loaded yet, it is synchronously loaded into the highlighter and defined
   * with Monaco before applying. This makes theme switching seamless for consumers.
   */
  const _setTheme = monaco.editor.setTheme.bind(monaco.editor);
  monaco.editor.setTheme = (themeName: string) => {
    ensureThemeLoaded(themeName);
    applyThemeColorMap(themeName);
    _setTheme(themeName);
  };

  // Monkey-patch create to trigger theme setup when an editor is created with a theme option.
  const _create = monaco.editor.create;
  monaco.editor.create = (element, options, override) => {
    if (options?.theme) {
      monaco.editor.setTheme(options.theme);
    }
    return _create(element, options, override);
  };

  // Install Shiki-based token providers for each loaded language.
  for (const lang of _highlighter.getLoadedLanguages()) {
    if (!shikiLanguageSet.has(lang)) continue;

    monaco.languages.setTokensProvider(lang, {
      getInitialState() {
        return new TokenizerState(INITIAL);
      },
      tokenize(line: string, state: TokenizerState) {
        if (line.length >= 20000) {
          return { endState: state, tokens: [{ startIndex: 0, scopes: "" }] };
        }

        const grammar = _highlighter.getLanguage(lang);

        /**
         * tokenizeTimeLimit: 0 disables the per-line timeout. The default 500ms timeout causes
         * vscode-textmate to return a corrupted mid-parse ruleStack when exceeded. Monaco feeds
         * this corrupted state to subsequent lines, causing a cascade where all lines after the
         * timeout lose syntax highlighting.
         */
        const result = grammar.tokenizeLine2(line, state.ruleStack, 0);

        const tokensLength = result.tokens.length / 2;
        const tokens: monaco.languages.IToken[] = [];

        for (let j = 0; j < tokensLength; j++) {
          const startIndex = result.tokens[2 * j];
          const metadata = result.tokens[2 * j + 1];
          const colorIdx = EncodedTokenMetadata.getForeground(metadata);
          const color = normalizeColor(colorMap[colorIdx] || "");
          const fontStyle = EncodedTokenMetadata.getFontStyle(metadata);
          const scope = color
            ? findScopeByColorAndStyle(color, fontStyle) || ""
            : "";
          tokens.push({ startIndex, scopes: scope });
        }

        return { endState: new TokenizerState(result.ruleStack), tokens };
      },
    });
  }

  // Apply the default theme so the color/scope maps are initialized.
  monaco.editor.setTheme(DEFAULT_THEME);
}

// ── Public API ────────────────────────────────────────────────────────────────

// Cached initialization promise — ensures `registerMonaco()` only runs once and all callers await the same result.
let initPromise: Promise<void> | null = null;

/**
 * Initialize Shiki's TextMate tokenizer and wire it into Monaco.
 * Safe to call multiple times — subsequent calls return the same promise.
 * Must be awaited BEFORE creating any Monaco editor instances so that:
 * 1. Monarch tokenizers are blocked for Shiki-managed languages
 * 2. Monkey-patches on `editor.create` / `editor.setTheme` are installed
 * 3. The default theme is defined and token providers are registered
 */
export function registerMonaco(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeShiki();
  }

  return initPromise;
}

/**
 * Initializes Shiki's TextMate tokenizer and wires it into Monaco.
 *
 * Performance optimizations:
 * 1. **JavaScript regex engine** instead of Oniguruma WASM — eliminates WASM download,
 *    compilation, and instantiation. The JS engine is synchronous and creates regexes lazily.
 * 2. **Single-theme initialization** — only the default theme is compiled at startup. Remaining
 *    themes are loaded on demand when first requested via `monaco.editor.setTheme()`.
 * 3. **Custom Monaco integration** — replaces `shikiToMonaco` to support lazy theme registration
 *    via a monkey-patched `setTheme` that transparently loads themes before applying them.
 */
async function initializeShiki(): Promise<void> {
  highlighter = await createHighlighterCore({
    themes: [EditorThemes[DEFAULT_THEME]],
    langs: [
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/ts"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/js"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/scss"),
    ],
    engine: createJavaScriptRegexEngine(),
  });

  // Register the default theme with Monaco before installing the integration.
  const tmTheme = highlighter.getTheme(DEFAULT_THEME);
  const monacoTheme = textmateThemeToMonacoTheme(tmTheme);
  monacoThemeMap.set(DEFAULT_THEME, monacoTheme);

  installMonacoIntegration();
}
