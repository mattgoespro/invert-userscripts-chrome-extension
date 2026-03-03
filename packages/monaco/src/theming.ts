import { createHighlighterCore, ThemeRegistration } from "@shikijs/core";
import { createOnigurumaEngine } from "@shikijs/engine-oniguruma";
import { shikiToMonaco } from "@shikijs/monaco";
import monaco from "monaco-editor";
import * as themes from "./themes";
import { CamelToKebabCase } from "./utils";

export type EditorThemeName = CamelToKebabCase<keyof typeof themes>;

/**
 * Raw TextMate theme definitions for all editor themes.
 */
const EditorThemes: Record<EditorThemeName, ThemeRegistration> = {
  andromeeda: themes.andromeeda,
  "aurora-x": themes.auroraX,
  "ayu-dark": themes.ayuDark,
  "ayu-mirage": themes.ayuMirage,
  "bearded-anthracite": themes.beardedAnthracite,
  "bearded-vivid-black": themes.beardedVividBlack,
  "dark-plus": themes.darkPlus,
  dracula: themes.dracula,
  "dracula-soft": themes.draculaSoft,
  "everforest-dark": themes.everforestDark,
  "github-dark": themes.githubDark,
  "github-dark-default": themes.githubDarkDefault,
  "github-dark-dimmed": themes.githubDarkDimmed,
  "github-dark-high-contrast": themes.githubDarkHighContrast,
  "graphite-dusk": themes.graphiteDusk,
  "gruvbox-dark-hard": themes.gruvboxDarkHard,
  "gruvbox-dark-medium": themes.gruvboxDarkMedium,
  "gruvbox-dark-soft": themes.gruvboxDarkSoft,
  horizon: themes.horizon,
  houston: themes.houston,
  "invert-dark": themes.invertDark,
  "kanagawa-dragon": themes.kanagawaDragon,
  "kanagawa-wave": themes.kanagawaWave,
  laserwave: themes.laserwave,
  "material-theme": themes.materialTheme,
  "material-theme-darker": themes.materialThemeDarker,
  "material-theme-ocean": themes.materialThemeOcean,
  "material-theme-palenight": themes.materialThemePalenight,
  "min-dark": themes.minDark,
  monokai: themes.monokai,
  "monokai-pro": themes.monokaiPro,
  nord: themes.nord,
  "one-dark-pro": themes.oneDarkPro,
  plastic: themes.plastic,
  poimandres: themes.poimandres,
  "rose-pine": themes.rosePine,
  "slack-dark": themes.slackDark,
  "tokyo-night": themes.tokyoNight,
  vesper: themes.vesper,
  "vitesse-black": themes.vitesseBlack,
  "vitesse-dark": themes.vitesseDark,
};

export function getThemeOptions(): { label: string; value: EditorThemeName }[] {
  return Object.entries(EditorThemes).map(([key, theme]) => ({
    label: theme.displayName,
    value: key as EditorThemeName,
  }));
}

/**
 * Initializes Shiki's TextMate tokenizer and wires it into Monaco. Safe to call multiple times —
 * subsequent calls return the same promise. Must be awaited BEFORE creating any Monaco editor
 * instances so that:
 * 1. Monarch tokenizers are blocked for Shiki-managed languages
 * 2. shikiToMonaco's monkey-patches of editor.create / editor.setTheme are installed
 * 3. Themes are defined and token providers are registered
 */
export async function applyHighlighter(): Promise<void> {
  // Languages managed by Shiki's TextMate tokenizer.
  const SHIKI_LANGUAGES = ["typescript", "javascript", "scss", "css"] as const;
  const shikiLanguageSet = new Set<string>(SHIKI_LANGUAGES);

  // Create the Shiki highlighter with all app themes and language grammars.
  const highlighter = await createHighlighterCore({
    themes: Object.values(EditorThemes),
    langs: [
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/ts"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/js"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/scss"),
    ],
    engine: await createOnigurumaEngine(import("@shikijs/engine-oniguruma/wasm-inlined")),
  });

  /**
   * Block Monarch tokenizers for Shiki-managed languages. This is done AFTER the highlighter is
   * successfully created so that if Shiki initialization fails, Monaco's built-in Monarch
   * tokenizers remain active as a fallback.
   */
  const _setMonarch = monaco.languages.setMonarchTokensProvider.bind(monaco.languages);

  monaco.languages.setMonarchTokensProvider = (languageId, languageDef) => {
    if (shikiLanguageSet.has(languageId)) {
      console.log(
        `Monarch token provider registration blocked for language "${languageId}" because it's managed by Shiki's TextMate tokenizer.`
      );
      return { dispose: () => {} };
    }
    return _setMonarch(languageId, languageDef);
  };

  // Register language IDs with Monaco so shikiToMonaco's monacoLanguageIds check passes.
  for (const lang of SHIKI_LANGUAGES) {
    monaco.languages.register({ id: lang });
  }

  /**
   * Wire Shiki's TextMate tokenizer into Monaco. This:
   * 1. Defines all themes via monaco.editor.defineTheme()
   * 2. Monkey-patches monaco.editor.create and monaco.editor.setTheme to manage
   *    the internal color map (needed for the tokenizer's reverse color→scope lookup)
   * 3. Installs setTokensProvider for each loaded language
   * Monaco's language service workers (LSP) remain active for intellisense,
   * diagnostics, and completions — Shiki only replaces the tokenization layer.
   */
  shikiToMonaco(highlighter, monaco, {
    /**
     * Disable the per-line tokenization time limit. The default 500ms timeout causes
     * vscode-textmate to return a corrupted mid-parse ruleStack when exceeded. Monaco
     * feeds this corrupted state to subsequent lines, causing a cascade where all lines
     * after the timeout lose syntax highlighting. Setting 0 disables the timeout entirely,
     * ensuring each line always completes full tokenization.
     */
    tokenizeTimeLimit: 0,
  });
}
