import { createHighlighterCore, ThemeRegistration, ThemeRegistrationResolved } from "@shikijs/core";
import { createOnigurumaEngine } from "@shikijs/engine-oniguruma";
import { shikiToMonaco, textmateThemeToMonacoTheme } from "@shikijs/monaco";
import monaco from "monaco-editor";
import * as themes from "./themes";

export type EditorThemeName = keyof typeof themes;

/**
 * Raw TextMate theme definitions for all editor themes loaded into the Shiki highlighter.
 */
export const EditorThemes: Record<EditorThemeName, ThemeRegistration> = {
  andromeeda: themes.andromeeda,
  auroraX: themes.auroraX,
  ayuDark: themes.ayuDark,
  ayuLight: themes.ayuLight,
  ayuMirage: themes.ayuMirage,
  beardedAnthracite: themes.beardedAnthracite,
  beardedArc: themes.beardedArc,
  beardedVividBlack: themes.beardedVividBlack,
  catppuccinFrappe: themes.catppuccinFrappe,
  catppuccinLatte: themes.catppuccinLatte,
  catppuccinMacchiato: themes.catppuccinMacchiato,
  catppuccinMocha: themes.catppuccinMocha,
  darkPlus: themes.darkPlus,
  dracula: themes.dracula,
  draculaSoft: themes.draculaSoft,
  everforestDark: themes.everforestDark,
  everforestLight: themes.everforestLight,
  githubDark: themes.githubDark,
  githubDarkDefault: themes.githubDarkDefault,
  githubDarkDimmed: themes.githubDarkDimmed,
  githubDarkHighContrast: themes.githubDarkHighContrast,
  githubLight: themes.githubLight,
  githubLightDefault: themes.githubLightDefault,
  githubLightHighContrast: themes.githubLightHighContrast,
  graphiteDusk: themes.graphiteDusk,
  gruvboxDarkHard: themes.gruvboxDarkHard,
  gruvboxDarkMedium: themes.gruvboxDarkMedium,
  gruvboxDarkSoft: themes.gruvboxDarkSoft,
  gruvboxLightHard: themes.gruvboxLightHard,
  gruvboxLightMedium: themes.gruvboxLightMedium,
  gruvboxLightSoft: themes.gruvboxLightSoft,
  horizon: themes.horizon,
  houston: themes.houston,
  invertDark: themes.invertDark,
  kanagawaDragon: themes.kanagawaDragon,
  kanagawaLotus: themes.kanagawaLotus,
  kanagawaWave: themes.kanagawaWave,
  laserwave: themes.laserwave,
  lightPlus: themes.lightPlus,
  materialTheme: themes.materialTheme,
  materialThemeDarker: themes.materialThemeDarker,
  materialThemeLighter: themes.materialThemeLighter,
  materialThemeOcean: themes.materialThemeOcean,
  materialThemePalenight: themes.materialThemePalenight,
  minDark: themes.minDark,
  minLight: themes.minLight,
  monokai: themes.monokai,
  monokaiPro: themes.monokaiPro,
  nightOwl: themes.nightOwl,
  nightOwlLight: themes.nightOwlLight,
  nord: themes.nord,
  oneDarkPro: themes.oneDarkPro,
  oneLight: themes.oneLight,
  plastic: themes.plastic,
  poimandres: themes.poimandres,
  red: themes.red,
  rosePine: themes.rosePine,
  rosePineDawn: themes.rosePineDawn,
  rosePineMoon: themes.rosePineMoon,
  slackDark: themes.slackDark,
  slackOchin: themes.slackOchin,
  snazzyLight: themes.snazzyLight,
  solarizedDark: themes.solarizedDark,
  solarizedLight: themes.solarizedLight,
  synthwave84: themes.synthwave84,
  tokyoNight: themes.tokyoNight,
  vesper: themes.vesper,
  vitesseBlack: themes.vitesseBlack,
  vitesseDark: themes.vitesseDark,
  vitesseLight: themes.vitesseLight,
};

// Monaco-ready theme definitions derived from the raw TextMate themes passed to the Shiki highlighter and registered via `monaco.editor.defineTheme()`.
const MonacoEditorThemes: Record<string, monaco.editor.IStandaloneThemeData> = Object.fromEntries(
  Object.entries(EditorThemes).map(([displayName, theme]) => [
    displayName,
    textmateThemeToMonacoTheme(theme as ThemeRegistrationResolved),
  ])
);

export function getThemeDisplayName(name: EditorThemeName): string {
  const themeDefinition = EditorThemes[name];

  if (!themeDefinition) {
    console.warn(`Theme with display name "${name}" not found. Falling back to default theme.`);
    return EditorThemes["darkPlus"].displayName;
  }

  return themeDefinition.displayName;
}

/**
 * Maps an EditorThemeName key to the theme's registered Monaco ID.
 * shikiToMonaco registers themes using the theme's `name` property
 * (e.g. "bearded-arc"), NOT the camelCase key or the displayName.
 */
export function getMonacoThemeId(name: EditorThemeName): string {
  const themeDefinition = EditorThemes[name];

  if (!themeDefinition) {
    console.warn(`Theme "${name}" not found. Falling back to default theme.`);
    return EditorThemes["darkPlus"].name!;
  }

  return themeDefinition.name!;
}

export function getTheme(name: EditorThemeName): monaco.editor.IStandaloneThemeData {
  const themeDefinition = EditorThemes[name];

  if (!themeDefinition) {
    console.warn(`Theme with name "${name}" not found. Falling back to default theme.`);
    return MonacoEditorThemes[EditorThemes["darkPlus"].displayName];
  }

  return MonacoEditorThemes[themeDefinition.displayName];
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
  shikiToMonaco(highlighter, monaco);
}
