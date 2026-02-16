import { createHighlighterCore, ThemeRegistrationRaw } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { shikiToMonaco } from "@shikijs/monaco";
import * as monaco from "monaco-editor";

// Languages managed by Shiki's TextMate tokenizer.
const SHIKI_LANGUAGES = ["typescript", "javascript", "scss", "css"] as const;

/**
 * Maps simplified Monarch-style scope names to their TextMate grammar equivalents.
 * TextMate grammars use hierarchical scopes (e.g., `entity.name.function` instead
 * of `function`). Shiki's TextMate engine uses prefix matching, so `keyword` matches
 * `keyword.control` — but `type` does NOT match `entity.name.type`, `function` does
 * NOT match `entity.name.function`, etc. This map bridges that gap.
 *
 * The themes keep their original simple scope names (used by ThemePreview) and these
 * TextMate equivalents are added at registration time for Shiki compatibility.
 */
const TEXTMATE_SCOPE_EXPANSIONS: Record<string, string[]> = {
  // `const`, `let`, `var`, `function`, `class` → storage.type
  // `export`, `async`, `static`, `public` → storage.modifier
  keyword: ["storage", "storage.type", "storage.modifier"],
  // User-defined types, built-in types, class names
  type: ["entity.name.type", "support.type", "support.class", "entity.other.inherited-class"],
  // More specific type identifier (class/interface names in themes that distinguish them)
  "type.identifier": ["entity.name.type", "entity.name.class"],
  // Function declarations and built-in functions
  function: ["entity.name.function", "support.function"],
  // Numeric literals (constant.numeric is under constant.* — needs explicit mapping
  // so themes with separate `number` and `constant` colors resolve correctly)
  number: ["constant.numeric"],
  // Operators in TextMate are keyword.operator.* — this MUST be more specific than
  // the `keyword` match to override it (keyword.operator has specificity 2 vs 1)
  operator: ["keyword.operator"],
  // Brackets, semicolons, commas → punctuation.*
  delimiter: ["punctuation", "meta.brace"],
  // HTML/JSX tags
  tag: ["entity.name.tag"],
  // HTML/CSS attribute names
  "attribute.name": ["entity.other.attribute-name"],
  // CSS attribute values
  "attribute.value": ["support.constant.property-value"],
  // Escape sequences
  "string.escape": ["constant.character.escape"],
};

/**
 * Expands a theme's settings to include TextMate-compatible scope names.
 * Original scopes are preserved (for ThemePreview and readability); TextMate
 * equivalents from TEXTMATE_SCOPE_EXPANSIONS are appended to each matching entry.
 */
function expandThemeForTextMate(theme: ThemeRegistrationRaw): ThemeRegistrationRaw {
  if (!theme.settings) {
    return theme;
  }

  const expandedSettings = theme.settings.map((entry) => {
    if (!entry.scope) {
      return entry;
    }

    const scopes = Array.isArray(entry.scope) ? [...entry.scope] : [entry.scope];
    const originalLength = scopes.length;

    for (const scope of scopes.slice()) {
      const additions = TEXTMATE_SCOPE_EXPANSIONS[scope];
      if (additions) {
        scopes.push(...additions);
      }
    }

    if (scopes.length === originalLength) {
      return entry;
    }

    return { ...entry, scope: scopes };
  });

  return { ...theme, settings: expandedSettings };
}

// Cached initialization promise — ensures registerMonaco() only runs once
// and all callers await the same result.
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
    initPromise = initializeMonaco();
  }
  return initPromise;
}

async function initializeMonaco(): Promise<void> {
  // Expand themes with TextMate-compatible scope names for Shiki.
  // The raw MonacoEditorThemes use simple Monarch-style scopes (e.g., "function")
  // that don't match TextMate grammar scopes (e.g., "entity.name.function").
  const themes = Object.values(MonacoEditorThemes).map(expandThemeForTextMate);

  // Block monarch tokenizer registrations for Shiki-managed languages. This MUST happen
  // before shikiToMonaco() and before Monaco's lazy language contributions load, so that
  // the built-in monarch tokenizers bundled by MonacoEditorWebpackPlugin never overwrite
  // Shiki's TextMate-based tokenizers.
  const shikiLanguageSet = new Set<string>(SHIKI_LANGUAGES);
  const _setMonarch = monaco.languages.setMonarchTokensProvider.bind(monaco.languages);
  monaco.languages.setMonarchTokensProvider = (languageId, languageDef) => {
    if (shikiLanguageSet.has(languageId as string)) {
      return { dispose: () => {} };
    }
    return _setMonarch(languageId, languageDef);
  };

  // Create the Shiki highlighter with all app themes and language grammars.
  // Uses the JavaScript regex engine (no WASM) for Chrome extension compatibility.
  const highlighter = await createHighlighterCore({
    themes,
    langs: [
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/scss"),
    ],
    engine: createJavaScriptRegexEngine(),
  });

  // Register language IDs with Monaco so shikiToMonaco's monacoLanguageIds check passes.
  for (const lang of SHIKI_LANGUAGES) {
    monaco.languages.register({ id: lang });
  }

  // Wire Shiki's TextMate tokenizer into Monaco. This:
  // 1. Defines all themes via monaco.editor.defineTheme()
  // 2. Monkey-patches monaco.editor.create and monaco.editor.setTheme to manage
  //    the internal color map (needed for the tokenizer's reverse color→scope lookup)
  // 3. Installs setTokensProvider for each loaded language
  // Monaco's language service workers (LSP) remain active for intellisense,
  // diagnostics, and completions — Shiki only replaces the tokenization layer.
  shikiToMonaco(highlighter, monaco);
}

export const MonacoEditorThemes: Record<string, ThemeRegistrationRaw> = {
  // ===========================================================================
  // Invert IDE App Themes
  // ===========================================================================
  "Invert Dark": {
    name: "invert-dark",
    type: "dark",
    fg: "#f0f0f0",
    bg: "#0a0a0c",
    settings: [
      { settings: { foreground: "#f0f0f0", background: "#0a0a0c" } },
      { scope: "keyword", settings: { foreground: "#da70d6", fontStyle: "bold" } },
      { scope: "keyword.control", settings: { foreground: "#da70d6" } },
      { scope: "type", settings: { foreground: "#4ec9b0" } },
      { scope: "type.identifier", settings: { foreground: "#4ec9b0" } },
      { scope: "string", settings: { foreground: "#ce9178" } },
      { scope: "string.escape", settings: { foreground: "#ffba00" } },
      { scope: "comment", settings: { foreground: "#808080", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#dcdcaa" } },
      { scope: "variable", settings: { foreground: "#9cdcfe" } },
      { scope: "variable.parameter", settings: { foreground: "#9cdcfe" } },
      { scope: "number", settings: { foreground: "#b5cea8" } },
      { scope: "constant", settings: { foreground: "#569cd6" } },
      { scope: "operator", settings: { foreground: "#f0f0f0" } },
      { scope: "delimiter", settings: { foreground: "#808080" } },
      { scope: "tag", settings: { foreground: "#569cd6" } },
      { scope: "attribute.name", settings: { foreground: "#9cdcfe" } },
      { scope: "attribute.value", settings: { foreground: "#ce9178" } },
    ],
    colors: {
      "editor.background": "#0a0a0c",
      "editor.foreground": "#f0f0f0",
      "editorLineNumber.foreground": "#808080",
      "editorLineNumber.activeForeground": "#f0f0f0",
      "editorCursor.foreground": "#ffba00",
      "editor.selectionBackground": "#1868c466",
      "editor.inactiveSelectionBackground": "#1868c433",
      "editorIndentGuide.background1": "#2d2d2d",
      "editorIndentGuide.activeBackground1": "#808080",
      "editor.lineHighlightBackground": "#1e1e1e",
      "editorBracketMatch.background": "#1868c433",
      "editorBracketMatch.border": "#1868c4",
    },
  },

  // ===========================================================================
  // Visual Studio Code Themes
  // ===========================================================================
  "VS Code Dark": {
    name: "vscode-dark",
    type: "dark",
    fg: "#d4d4d4",
    bg: "#1e1e1e",
    settings: [
      { settings: { foreground: "#d4d4d4", background: "#1e1e1e" } },
      { scope: "keyword", settings: { foreground: "#569cd6" } },
      { scope: "keyword.control", settings: { foreground: "#c586c0" } },
      { scope: "type", settings: { foreground: "#4ec9b0" } },
      { scope: "string", settings: { foreground: "#ce9178" } },
      { scope: "comment", settings: { foreground: "#6a9955", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#dcdcaa" } },
      { scope: "variable", settings: { foreground: "#9cdcfe" } },
      { scope: "number", settings: { foreground: "#b5cea8" } },
      { scope: "constant", settings: { foreground: "#4fc1ff" } },
      { scope: "operator", settings: { foreground: "#d4d4d4" } },
      { scope: "delimiter", settings: { foreground: "#808080" } },
    ],
    colors: {
      "checkbox.border": "#6B6B6B",
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editor.inactiveSelectionBackground": "#3A3D41",
      "editorIndentGuide.background1": "#404040",
      "editorIndentGuide.activeBackground1": "#707070",
      "editor.selectionHighlightBackground": "#ADD6FF26",
      "list.dropBackground": "#383B3D",
      "activityBarBadge.background": "#007ACC",
      "sideBarTitle.foreground": "#BBBBBB",
      "input.placeholderForeground": "#A6A6A6",
      "menu.background": "#252526",
      "menu.foreground": "#CCCCCC",
      "menu.separatorBackground": "#454545",
      "menu.border": "#454545",
      "menu.selectionBackground": "#0078d4",
      "statusBarItem.remoteForeground": "#FFF",
      "statusBarItem.remoteBackground": "#16825D",
      "ports.iconRunningProcessForeground": "#369432",
      "sideBarSectionHeader.background": "#0000",
      "sideBarSectionHeader.border": "#ccc3",
      "tab.selectedBackground": "#222222",
      "tab.selectedForeground": "#ffffffa0",
      "tab.lastPinnedBorder": "#ccc3",
      "list.activeSelectionIconForeground": "#FFF",
      "terminal.inactiveSelectionBackground": "#3A3D41",
      "widget.border": "#303031",
      "actionBar.toggledBackground": "#383a49",
    },
  },
  "VS Code Dark+": {
    name: "vscode-dark-plus",
    type: "dark",
    fg: "#d4d4d4",
    bg: "#1e1e1e",
    colors: {
      "actionBar.toggledBackground": "#383a49",
      "activityBarBadge.background": "#007ACC",
      "checkbox.border": "#6B6B6B",
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editor.inactiveSelectionBackground": "#3A3D41",
      "editor.selectionHighlightBackground": "#ADD6FF26",
      "editorIndentGuide.activeBackground1": "#707070",
      "editorIndentGuide.background1": "#404040",
      "input.placeholderForeground": "#A6A6A6",
      "list.activeSelectionIconForeground": "#FFF",
      "list.dropBackground": "#383B3D",
      "menu.background": "#252526",
      "menu.border": "#454545",
      "menu.foreground": "#CCCCCC",
      "menu.selectionBackground": "#0078d4",
      "menu.separatorBackground": "#454545",
      "ports.iconRunningProcessForeground": "#369432",
      "sideBarSectionHeader.background": "#0000",
      "sideBarSectionHeader.border": "#ccc3",
      "sideBarTitle.foreground": "#BBBBBB",
      "statusBarItem.remoteBackground": "#16825D",
      "statusBarItem.remoteForeground": "#FFF",
      "tab.lastPinnedBorder": "#ccc3",
      "tab.selectedBackground": "#222222",
      "tab.selectedForeground": "#ffffffa0",
      "terminal.inactiveSelectionBackground": "#3A3D41",
      "widget.border": "#303031",
    },
    settings: [
      {
        scope: [
          "meta.embedded",
          "source.groovy.embedded",
          "string meta.image.inline.markdown",
          "variable.legacy.builtin.python",
        ],
        settings: {
          foreground: "#D4D4D4",
        },
      },
      {
        scope: "emphasis",
        settings: {
          fontStyle: "italic",
        },
      },
      {
        scope: "strong",
        settings: {
          fontStyle: "bold",
        },
      },
      {
        scope: "header",
        settings: {
          foreground: "#000080",
        },
      },
      {
        scope: "comment",
        settings: {
          foreground: "#6A9955",
        },
      },
      {
        scope: "constant.language",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: [
          "constant.numeric",
          "variable.other.enummember",
          "keyword.operator.plus.exponent",
          "keyword.operator.minus.exponent",
        ],
        settings: {
          foreground: "#b5cea8",
        },
      },
      {
        scope: "constant.regexp",
        settings: {
          foreground: "#646695",
        },
      },
      {
        scope: "entity.name.tag",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: ["entity.name.tag.css", "entity.name.tag.less"],
        settings: {
          foreground: "#d7ba7d",
        },
      },
      {
        scope: "entity.other.attribute-name",
        settings: {
          foreground: "#9cdcfe",
        },
      },
      {
        scope: [
          "entity.other.attribute-name.class.css",
          "source.css entity.other.attribute-name.class",
          "entity.other.attribute-name.id.css",
          "entity.other.attribute-name.parent-selector.css",
          "entity.other.attribute-name.parent.less",
          "source.css entity.other.attribute-name.pseudo-class",
          "entity.other.attribute-name.pseudo-element.css",
          "source.css.less entity.other.attribute-name.id",
          "entity.other.attribute-name.scss",
        ],
        settings: {
          foreground: "#d7ba7d",
        },
      },
      {
        scope: "invalid",
        settings: {
          foreground: "#f44747",
        },
      },
      {
        scope: "markup.underline",
        settings: {
          fontStyle: "underline",
        },
      },
      {
        scope: "markup.bold",
        settings: {
          fontStyle: "bold",
          foreground: "#569cd6",
        },
      },
      {
        scope: "markup.heading",
        settings: {
          fontStyle: "bold",
          foreground: "#569cd6",
        },
      },
      {
        scope: "markup.italic",
        settings: {
          fontStyle: "italic",
        },
      },
      {
        scope: "markup.strikethrough",
        settings: {
          fontStyle: "strikethrough",
        },
      },
      {
        scope: "markup.inserted",
        settings: {
          foreground: "#b5cea8",
        },
      },
      {
        scope: "markup.deleted",
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "markup.changed",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "punctuation.definition.quote.begin.markdown",
        settings: {
          foreground: "#6A9955",
        },
      },
      {
        scope: "punctuation.definition.list.begin.markdown",
        settings: {
          foreground: "#6796e6",
        },
      },
      {
        scope: "markup.inline.raw",
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "punctuation.definition.tag",
        settings: {
          foreground: "#808080",
        },
      },
      {
        scope: ["meta.preprocessor", "entity.name.function.preprocessor"],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "meta.preprocessor.string",
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "meta.preprocessor.numeric",
        settings: {
          foreground: "#b5cea8",
        },
      },
      {
        scope: "meta.structure.dictionary.key.python",
        settings: {
          foreground: "#9cdcfe",
        },
      },
      {
        scope: "meta.diff.header",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "storage",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "storage.type",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: ["storage.modifier", "keyword.operator.noexcept"],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: ["string", "meta.embedded.assembly"],
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "string.tag",
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "string.value",
        settings: {
          foreground: "#ce9178",
        },
      },
      {
        scope: "string.regexp",
        settings: {
          foreground: "#d16969",
        },
      },
      {
        scope: [
          "punctuation.definition.template-expression.begin",
          "punctuation.definition.template-expression.end",
          "punctuation.section.embedded",
        ],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: ["meta.template.expression"],
        settings: {
          foreground: "#d4d4d4",
        },
      },
      {
        scope: [
          "support.type.vendored.property-name",
          "support.type.property-name",
          "source.css variable",
          "source.coffee.embedded",
        ],
        settings: {
          foreground: "#9cdcfe",
        },
      },
      {
        scope: "keyword",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "keyword.control",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "keyword.operator",
        settings: {
          foreground: "#d4d4d4",
        },
      },
      {
        scope: [
          "keyword.operator.new",
          "keyword.operator.expression",
          "keyword.operator.cast",
          "keyword.operator.sizeof",
          "keyword.operator.alignof",
          "keyword.operator.typeid",
          "keyword.operator.alignas",
          "keyword.operator.instanceof",
          "keyword.operator.logical.python",
          "keyword.operator.wordlike",
        ],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "keyword.other.unit",
        settings: {
          foreground: "#b5cea8",
        },
      },
      {
        scope: ["punctuation.section.embedded.begin.php", "punctuation.section.embedded.end.php"],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "support.function.git-rebase",
        settings: {
          foreground: "#9cdcfe",
        },
      },
      {
        scope: "constant.sha.git-rebase",
        settings: {
          foreground: "#b5cea8",
        },
      },
      {
        scope: [
          "storage.modifier.import.java",
          "variable.language.wildcard.java",
          "storage.modifier.package.java",
        ],
        settings: {
          foreground: "#d4d4d4",
        },
      },
      {
        scope: "variable.language",
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: [
          "entity.name.function",
          "support.function",
          "support.constant.handlebars",
          "source.powershell variable.other.member",
          "entity.name.operator.custom-literal",
        ],
        settings: {
          foreground: "#DCDCAA",
        },
      },
      {
        scope: [
          "support.class",
          "support.type",
          "entity.name.type",
          "entity.name.namespace",
          "entity.other.attribute",
          "entity.name.scope-resolution",
          "entity.name.class",
          "storage.type.numeric.go",
          "storage.type.byte.go",
          "storage.type.boolean.go",
          "storage.type.string.go",
          "storage.type.uintptr.go",
          "storage.type.error.go",
          "storage.type.rune.go",
          "storage.type.cs",
          "storage.type.generic.cs",
          "storage.type.modifier.cs",
          "storage.type.variable.cs",
          "storage.type.annotation.java",
          "storage.type.generic.java",
          "storage.type.java",
          "storage.type.object.array.java",
          "storage.type.primitive.array.java",
          "storage.type.primitive.java",
          "storage.type.token.java",
          "storage.type.groovy",
          "storage.type.annotation.groovy",
          "storage.type.parameters.groovy",
          "storage.type.generic.groovy",
          "storage.type.object.array.groovy",
          "storage.type.primitive.array.groovy",
          "storage.type.primitive.groovy",
        ],
        settings: {
          foreground: "#4EC9B0",
        },
      },
      {
        scope: [
          "meta.type.cast.expr",
          "meta.type.new.expr",
          "support.constant.math",
          "support.constant.dom",
          "support.constant.json",
          "entity.other.inherited-class",
          "punctuation.separator.namespace.ruby",
        ],
        settings: {
          foreground: "#4EC9B0",
        },
      },
      {
        scope: [
          "keyword.control",
          "source.cpp keyword.operator.new",
          "keyword.operator.delete",
          "keyword.other.using",
          "keyword.other.directive.using",
          "keyword.other.operator",
          "entity.name.operator",
        ],
        settings: {
          foreground: "#C586C0",
        },
      },
      {
        scope: [
          "variable",
          "meta.definition.variable.name",
          "support.variable",
          "entity.name.variable",
          "constant.other.placeholder",
        ],
        settings: {
          foreground: "#9CDCFE",
        },
      },
      {
        scope: ["variable.other.constant", "variable.other.enummember"],
        settings: {
          foreground: "#4FC1FF",
        },
      },
      {
        scope: ["meta.object-literal.key"],
        settings: {
          foreground: "#9CDCFE",
        },
      },
      {
        scope: [
          "support.constant.property-value",
          "support.constant.font-name",
          "support.constant.media-type",
          "support.constant.media",
          "constant.other.color.rgb-value",
          "constant.other.rgb-value",
          "support.constant.color",
        ],
        settings: {
          foreground: "#CE9178",
        },
      },
      {
        scope: [
          "punctuation.definition.group.regexp",
          "punctuation.definition.group.assertion.regexp",
          "punctuation.definition.character-class.regexp",
          "punctuation.character.set.begin.regexp",
          "punctuation.character.set.end.regexp",
          "keyword.operator.negation.regexp",
          "support.other.parenthesis.regexp",
        ],
        settings: {
          foreground: "#CE9178",
        },
      },
      {
        scope: [
          "constant.character.character-class.regexp",
          "constant.other.character-class.set.regexp",
          "constant.other.character-class.regexp",
          "constant.character.set.regexp",
        ],
        settings: {
          foreground: "#d16969",
        },
      },
      {
        scope: ["keyword.operator.or.regexp", "keyword.control.anchor.regexp"],
        settings: {
          foreground: "#DCDCAA",
        },
      },
      {
        scope: "keyword.operator.quantifier.regexp",
        settings: {
          foreground: "#d7ba7d",
        },
      },
      {
        scope: ["constant.character", "constant.other.option"],
        settings: {
          foreground: "#569cd6",
        },
      },
      {
        scope: "constant.character.escape",
        settings: {
          foreground: "#d7ba7d",
        },
      },
      {
        scope: "entity.name.label",
        settings: {
          foreground: "#C8C8C8",
        },
      },
    ],
  },
  "VS Code Dark Modern": {
    name: "vscode-dark-modern",
    type: "dark",
    fg: "#cccccc",
    bg: "#1f1f1f",
    settings: [
      { settings: { foreground: "#cccccc", background: "#1f1f1f" } },
      { scope: "keyword", settings: { foreground: "#569cd6" } },
      { scope: "keyword.control", settings: { foreground: "#c586c0" } },
      { scope: "type", settings: { foreground: "#4ec9b0" } },
      { scope: "type.identifier", settings: { foreground: "#4ec9b0" } },
      { scope: "string", settings: { foreground: "#ce9178" } },
      { scope: "string.escape", settings: { foreground: "#d7ba7d" } },
      { scope: "comment", settings: { foreground: "#6a9955", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#dcdcaa" } },
      { scope: "variable", settings: { foreground: "#9cdcfe" } },
      { scope: "variable.parameter", settings: { foreground: "#9cdcfe" } },
      { scope: "number", settings: { foreground: "#b5cea8" } },
      { scope: "constant", settings: { foreground: "#4fc1ff" } },
      { scope: "operator", settings: { foreground: "#cccccc" } },
      { scope: "delimiter", settings: { foreground: "#808080" } },
      { scope: "tag", settings: { foreground: "#569cd6" } },
      { scope: "attribute.name", settings: { foreground: "#9cdcfe" } },
      { scope: "attribute.value", settings: { foreground: "#ce9178" } },
    ],
    colors: {
      "activityBar.activeBorder": "#0078D4",
      "activityBar.background": "#181818",
      "activityBar.border": "#2B2B2B",
      "activityBar.foreground": "#D7D7D7",
      "activityBar.inactiveForeground": "#868686",
      "activityBarBadge.background": "#0078D4",
      "activityBarBadge.foreground": "#FFFFFF",
      "badge.background": "#616161",
      "badge.foreground": "#F8F8F8",
      "button.background": "#0078D4",
      "button.border": "#ffffff1a",
      "button.foreground": "#FFFFFF",
      "button.hoverBackground": "#026EC1",
      "button.secondaryBackground": "#00000000",
      "button.secondaryForeground": "#CCCCCC",
      "button.secondaryHoverBackground": "#2B2B2B",
      "chat.slashCommandBackground": "#26477866",
      "chat.slashCommandForeground": "#85B6FF",
      "chat.editedFileForeground": "#E2C08D",
      "checkbox.background": "#313131",
      "checkbox.border": "#3C3C3C",
      "debugToolBar.background": "#181818",
      descriptionForeground: "#9D9D9D",
      "dropdown.background": "#313131",
      "dropdown.border": "#3C3C3C",
      "dropdown.foreground": "#CCCCCC",
      "dropdown.listBackground": "#1F1F1F",
      "editor.background": "#1F1F1F",
      "editor.findMatchBackground": "#9E6A03",
      "editor.foreground": "#CCCCCC",
      "editorGroup.border": "#FFFFFF17",
      "editorGroupHeader.tabsBackground": "#181818",
      "editorGroupHeader.tabsBorder": "#2B2B2B",
      "editorGutter.addedBackground": "#2EA043",
      "editorGutter.deletedBackground": "#F85149",
      "editorGutter.modifiedBackground": "#0078D4",
      "editorLineNumber.activeForeground": "#CCCCCC",
      "editorLineNumber.foreground": "#6E7681",
      "editorOverviewRuler.border": "#010409",
      "editorWidget.background": "#202020",
      errorForeground: "#F85149",
      focusBorder: "#0078D4",
      foreground: "#CCCCCC",
      "icon.foreground": "#CCCCCC",
      "input.background": "#313131",
      "input.border": "#3C3C3C",
      "input.foreground": "#CCCCCC",
      "input.placeholderForeground": "#989898",
      "inputOption.activeBackground": "#2489DB82",
      "inputOption.activeBorder": "#2488DB",
      "keybindingLabel.foreground": "#CCCCCC",
      "menu.background": "#1F1F1F",
      "menu.selectionBackground": "#0078d4",
      "notificationCenterHeader.background": "#1F1F1F",
      "notificationCenterHeader.foreground": "#CCCCCC",
      "notifications.background": "#1F1F1F",
      "notifications.border": "#2B2B2B",
      "notifications.foreground": "#CCCCCC",
      "panel.background": "#181818",
      "panel.border": "#2B2B2B",
      "panelInput.border": "#2B2B2B",
      "panelTitle.activeBorder": "#0078D4",
      "panelTitle.activeForeground": "#CCCCCC",
      "panelTitle.inactiveForeground": "#9D9D9D",
      "peekViewEditor.background": "#1F1F1F",
      "peekViewEditor.matchHighlightBackground": "#BB800966",
      "peekViewResult.background": "#1F1F1F",
      "peekViewResult.matchHighlightBackground": "#BB800966",
      "pickerGroup.border": "#3C3C3C",
      "progressBar.background": "#0078D4",
      "quickInput.background": "#222222",
      "quickInput.foreground": "#CCCCCC",
      "settings.dropdownBackground": "#313131",
      "settings.dropdownBorder": "#3C3C3C",
      "settings.headerForeground": "#FFFFFF",
      "settings.modifiedItemIndicator": "#BB800966",
      "sideBar.background": "#181818",
      "sideBar.border": "#2B2B2B",
      "sideBar.foreground": "#CCCCCC",
      "sideBarSectionHeader.background": "#181818",
      "sideBarSectionHeader.border": "#2B2B2B",
      "sideBarSectionHeader.foreground": "#CCCCCC",
      "sideBarTitle.foreground": "#CCCCCC",
      "statusBar.background": "#181818",
      "statusBar.border": "#2B2B2B",
      "statusBarItem.hoverBackground": "#F1F1F133",
      "statusBarItem.hoverForeground": "#FFFFFF",
      "statusBar.debuggingBackground": "#0078D4",
      "statusBar.debuggingForeground": "#FFFFFF",
      "statusBar.focusBorder": "#0078D4",
      "statusBar.foreground": "#CCCCCC",
      "statusBar.noFolderBackground": "#1F1F1F",
      "statusBarItem.focusBorder": "#0078D4",
      "statusBarItem.prominentBackground": "#6E768166",
      "statusBarItem.remoteBackground": "#0078D4",
      "statusBarItem.remoteForeground": "#FFFFFF",
      "tab.activeBackground": "#1F1F1F",
      "tab.activeBorder": "#1F1F1F",
      "tab.activeBorderTop": "#0078D4",
      "tab.activeForeground": "#FFFFFF",
      "tab.selectedBorderTop": "#6caddf",
      "tab.border": "#2B2B2B",
      "tab.hoverBackground": "#1F1F1F",
      "tab.inactiveBackground": "#181818",
      "tab.inactiveForeground": "#9D9D9D",
      "tab.unfocusedActiveBorder": "#1F1F1F",
      "tab.unfocusedActiveBorderTop": "#2B2B2B",
      "tab.unfocusedHoverBackground": "#1F1F1F",
      "terminal.foreground": "#CCCCCC",
      "terminal.tab.activeBorder": "#0078D4",
      "textBlockQuote.background": "#2B2B2B",
      "textBlockQuote.border": "#616161",
      "textCodeBlock.background": "#2B2B2B",
      "textLink.activeForeground": "#4daafc",
      "textLink.foreground": "#4daafc",
      "textPreformat.foreground": "#D0D0D0",
      "textPreformat.background": "#3C3C3C",
      "textSeparator.foreground": "#21262D",
      "titleBar.activeBackground": "#181818",
      "titleBar.activeForeground": "#CCCCCC",
      "titleBar.border": "#2B2B2B",
      "titleBar.inactiveBackground": "#1F1F1F",
      "titleBar.inactiveForeground": "#9D9D9D",
      "welcomePage.tileBackground": "#2B2B2B",
      "welcomePage.progress.foreground": "#0078D4",
      "widget.border": "#313131",
    },
  },

  // ===========================================================================
  // Material Themes
  // ===========================================================================
  "Material Darker": {
    name: "material-darker",
    type: "dark",
    fg: "#eeffff",
    bg: "#212121",
    settings: [
      { settings: { foreground: "#eeffff", background: "#212121" } },
      { scope: "keyword", settings: { foreground: "#c792ea", fontStyle: "bold" } },
      { scope: "keyword.control", settings: { foreground: "#c792ea" } },
      { scope: "type", settings: { foreground: "#ffcb6b" } },
      { scope: "type.identifier", settings: { foreground: "#ffcb6b" } },
      { scope: "string", settings: { foreground: "#c3e88d" } },
      { scope: "string.escape", settings: { foreground: "#89ddff" } },
      { scope: "comment", settings: { foreground: "#545454", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#82aaff" } },
      { scope: "variable", settings: { foreground: "#eeffff" } },
      { scope: "variable.parameter", settings: { foreground: "#f78c6c" } },
      { scope: "number", settings: { foreground: "#f78c6c" } },
      { scope: "constant", settings: { foreground: "#f78c6c" } },
      { scope: "operator", settings: { foreground: "#89ddff" } },
      { scope: "delimiter", settings: { foreground: "#89ddff" } },
      { scope: "tag", settings: { foreground: "#f07178" } },
      { scope: "attribute.name", settings: { foreground: "#ffcb6b" } },
      { scope: "attribute.value", settings: { foreground: "#c3e88d" } },
    ],
    colors: {
      "editor.background": "#212121",
      "editor.foreground": "#eeffff",
      "editorLineNumber.foreground": "#424242",
      "editorLineNumber.activeForeground": "#89ddff",
      "editorCursor.foreground": "#ffcc00",
      "editor.selectionBackground": "#61616150",
      "editor.inactiveSelectionBackground": "#42424240",
      "editorIndentGuide.background1": "#424242",
      "editorIndentGuide.activeBackground1": "#616161",
      "editor.lineHighlightBackground": "#2a2a2a",
      "editorBracketMatch.background": "#61616150",
      "editorBracketMatch.border": "#ffcc00",
    },
  },

  // ===========================================================================
  // GitHub Themes
  // ===========================================================================
  "GitHub Dark": {
    name: "github-dark",
    type: "dark",
    fg: "#c9d1d9",
    bg: "#0d1117",
    settings: [
      { settings: { foreground: "#c9d1d9", background: "#0d1117" } },
      { scope: "keyword", settings: { foreground: "#ff7b72" } },
      { scope: "keyword.control", settings: { foreground: "#ff7b72" } },
      { scope: "type", settings: { foreground: "#ffa657" } },
      { scope: "type.identifier", settings: { foreground: "#ffa657" } },
      { scope: "string", settings: { foreground: "#a5d6ff" } },
      { scope: "string.escape", settings: { foreground: "#79c0ff" } },
      { scope: "comment", settings: { foreground: "#8b949e", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#d2a8ff" } },
      { scope: "variable", settings: { foreground: "#c9d1d9" } },
      { scope: "variable.parameter", settings: { foreground: "#ffa657" } },
      { scope: "number", settings: { foreground: "#79c0ff" } },
      { scope: "constant", settings: { foreground: "#79c0ff" } },
      { scope: "operator", settings: { foreground: "#ff7b72" } },
      { scope: "delimiter", settings: { foreground: "#c9d1d9" } },
      { scope: "tag", settings: { foreground: "#7ee787" } },
      { scope: "attribute.name", settings: { foreground: "#79c0ff" } },
      { scope: "attribute.value", settings: { foreground: "#a5d6ff" } },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#c9d1d9",
      "editorCursor.foreground": "#58a6ff",
      "editor.selectionBackground": "#264f7866",
      "editor.inactiveSelectionBackground": "#264f7844",
      "editorIndentGuide.background1": "#21262d",
      "editorIndentGuide.activeBackground1": "#30363d",
      "editor.lineHighlightBackground": "#161b22",
      "editorBracketMatch.background": "#264f7866",
      "editorBracketMatch.border": "#58a6ff",
    },
  },
  "GitHub Dark Dimmed": {
    name: "github-dark-dimmed",
    type: "dark",
    fg: "#adbac7",
    bg: "#22272e",
    settings: [
      { settings: { foreground: "#adbac7", background: "#22272e" } },
      { scope: "keyword", settings: { foreground: "#f47067" } },
      { scope: "keyword.control", settings: { foreground: "#f47067" } },
      { scope: "type", settings: { foreground: "#f69d50" } },
      { scope: "type.identifier", settings: { foreground: "#f69d50" } },
      { scope: "string", settings: { foreground: "#96d0ff" } },
      { scope: "string.escape", settings: { foreground: "#6cb6ff" } },
      { scope: "comment", settings: { foreground: "#768390", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#dcbdfb" } },
      { scope: "variable", settings: { foreground: "#adbac7" } },
      { scope: "variable.parameter", settings: { foreground: "#f69d50" } },
      { scope: "number", settings: { foreground: "#6cb6ff" } },
      { scope: "constant", settings: { foreground: "#6cb6ff" } },
      { scope: "operator", settings: { foreground: "#f47067" } },
      { scope: "delimiter", settings: { foreground: "#adbac7" } },
      { scope: "tag", settings: { foreground: "#8ddb8c" } },
      { scope: "attribute.name", settings: { foreground: "#6cb6ff" } },
      { scope: "attribute.value", settings: { foreground: "#96d0ff" } },
    ],
    colors: {
      "editor.background": "#22272e",
      "editor.foreground": "#adbac7",
      "editorLineNumber.foreground": "#636e7b",
      "editorLineNumber.activeForeground": "#adbac7",
      "editorCursor.foreground": "#539bf5",
      "editor.selectionBackground": "#3d6b9866",
      "editor.inactiveSelectionBackground": "#3d6b9844",
      "editorIndentGuide.background1": "#2d333b",
      "editorIndentGuide.activeBackground1": "#373e47",
      "editor.lineHighlightBackground": "#2d333b",
      "editorBracketMatch.background": "#3d6b9866",
      "editorBracketMatch.border": "#539bf5",
    },
  },

  // ===========================================================================
  // Monokai
  // ===========================================================================
  Monokai: {
    name: "monokai",
    type: "dark",
    fg: "#f8f8f2",
    bg: "#272822",
    settings: [
      { settings: { foreground: "#f8f8f2", background: "#272822" } },
      { scope: "keyword", settings: { foreground: "#f92672" } },
      { scope: "keyword.control", settings: { foreground: "#f92672" } },
      { scope: "type", settings: { foreground: "#66d9ef", fontStyle: "italic" } },
      { scope: "type.identifier", settings: { foreground: "#a6e22e" } },
      { scope: "string", settings: { foreground: "#e6db74" } },
      { scope: "string.escape", settings: { foreground: "#ae81ff" } },
      { scope: "comment", settings: { foreground: "#88846f", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#a6e22e" } },
      { scope: "variable", settings: { foreground: "#f8f8f2" } },
      { scope: "variable.parameter", settings: { foreground: "#fd971f", fontStyle: "italic" } },
      { scope: "number", settings: { foreground: "#ae81ff" } },
      { scope: "constant", settings: { foreground: "#ae81ff" } },
      { scope: "operator", settings: { foreground: "#f92672" } },
      { scope: "delimiter", settings: { foreground: "#f8f8f2" } },
      { scope: "tag", settings: { foreground: "#f92672" } },
      { scope: "attribute.name", settings: { foreground: "#a6e22e" } },
      { scope: "attribute.value", settings: { foreground: "#e6db74" } },
    ],
    colors: {
      "editor.background": "#272822",
      "editor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#90908a",
      "editorLineNumber.activeForeground": "#f8f8f2",
      "editorCursor.foreground": "#f8f8f0",
      "editor.selectionBackground": "#49483e",
      "editor.inactiveSelectionBackground": "#49483e80",
      "editorIndentGuide.background1": "#464741",
      "editorIndentGuide.activeBackground1": "#767771",
      "editor.lineHighlightBackground": "#3e3d32",
      "editorBracketMatch.background": "#49483e",
      "editorBracketMatch.border": "#75715e",
    },
  },
  "Monokai Pro": {
    name: "monokai-pro",
    fg: "#fcfcfa",
    bg: "#2d2a2e",
    type: "dark",
    settings: [
      { settings: { foreground: "#fcfcfa", background: "#2d2a2e" } },
      { scope: "keyword", settings: { foreground: "#ff6188" } },
      { scope: "keyword.control", settings: { foreground: "#ff6188" } },
      { scope: "type", settings: { foreground: "#78dce8", fontStyle: "italic" } },
      { scope: "type.identifier", settings: { foreground: "#a9dc76" } },
      { scope: "string", settings: { foreground: "#ffd866" } },
      { scope: "string.escape", settings: { foreground: "#ab9df2" } },
      { scope: "comment", settings: { foreground: "#727072", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#a9dc76" } },
      { scope: "variable", settings: { foreground: "#fcfcfa" } },
      { scope: "variable.parameter", settings: { foreground: "#fc9867", fontStyle: "italic" } },
      { scope: "number", settings: { foreground: "#ab9df2" } },
      { scope: "constant", settings: { foreground: "#ab9df2" } },
      { scope: "operator", settings: { foreground: "#ff6188" } },
      { scope: "delimiter", settings: { foreground: "#939293" } },
      { scope: "tag", settings: { foreground: "#ff6188" } },
      { scope: "attribute.name", settings: { foreground: "#78dce8" } },
      { scope: "attribute.value", settings: { foreground: "#ffd866" } },
    ],
    colors: {
      "editor.background": "#2d2a2e",
      "editor.foreground": "#fcfcfa",
      "editorLineNumber.foreground": "#5b595c",
      "editorLineNumber.activeForeground": "#c1c0c0",
      "editorCursor.foreground": "#fcfcfa",
      "editor.selectionBackground": "#5b595c80",
      "editor.inactiveSelectionBackground": "#5b595c40",
      "editorIndentGuide.background1": "#403e41",
      "editorIndentGuide.activeBackground1": "#5b595c",
      "editor.lineHighlightBackground": "#363337",
      "editorBracketMatch.background": "#5b595c80",
      "editorBracketMatch.border": "#ffd866",
    },
  },

  // ===========================================================================
  // Bearded Themes
  // ===========================================================================
  "Bearded Arc": {
    name: "bearded-arc",
    type: "dark",
    fg: "#8196b5",
    bg: "#1c2433",
    settings: [
      { settings: { foreground: "#8196b5", background: "#1c2433" } },
      { scope: "keyword", settings: { foreground: "#eacd61" } },
      { scope: "keyword.control", settings: { foreground: "#eacd61" } },
      { scope: "type", settings: { foreground: "#b78aff" } },
      { scope: "type.identifier", settings: { foreground: "#a4ef58" } },
      { scope: "string", settings: { foreground: "#3cec85" } },
      { scope: "string.escape", settings: { foreground: "#ff955c" } },
      { scope: "comment", settings: { foreground: "#4a5567", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#69c3ff" } },
      { scope: "variable", settings: { foreground: "#ff738a" } },
      { scope: "variable.parameter", settings: { foreground: "#f38cec" } },
      { scope: "number", settings: { foreground: "#e35535" } },
      { scope: "constant", settings: { foreground: "#e35535" } },
      { scope: "operator", settings: { foreground: "#eacd61" } },
      { scope: "delimiter", settings: { foreground: "#5a6a80" } },
      { scope: "tag", settings: { foreground: "#69c3ff" } },
      { scope: "attribute.name", settings: { foreground: "#eacd61" } },
      { scope: "attribute.value", settings: { foreground: "#3cec85" } },
    ],
    colors: {
      "editor.background": "#1c2433",
      "editor.foreground": "#8196b5",
      "editorLineNumber.foreground": "#3b4858",
      "editorLineNumber.activeForeground": "#8196b5",
      "editorCursor.foreground": "#eacd61",
      "editor.selectionBackground": "#8196b530",
      "editor.inactiveSelectionBackground": "#8196b520",
      "editorIndentGuide.background1": "#2a3545",
      "editorIndentGuide.activeBackground1": "#3b4858",
      "editor.lineHighlightBackground": "#1f2838",
      "editorBracketMatch.background": "#8196b530",
      "editorBracketMatch.border": "#eacd61",
    },
  },
  "Bearded Anthracite": {
    name: "bearded-anthracite",
    type: "dark",
    fg: "#a2abb6",
    bg: "#181a1f",
    settings: [
      { settings: { foreground: "#a2abb6", background: "#181a1f" } },
      { scope: "keyword", settings: { foreground: "#c9a022" } },
      { scope: "keyword.control", settings: { foreground: "#c9a022" } },
      { scope: "type", settings: { foreground: "#935cd1" } },
      { scope: "type.identifier", settings: { foreground: "#7e9e2d" } },
      { scope: "string", settings: { foreground: "#37ae6f" } },
      { scope: "string.escape", settings: { foreground: "#d26d32" } },
      { scope: "comment", settings: { foreground: "#505860", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#3398db" } },
      { scope: "variable", settings: { foreground: "#de456b" } },
      { scope: "variable.parameter", settings: { foreground: "#cc71bc" } },
      { scope: "number", settings: { foreground: "#c13838" } },
      { scope: "constant", settings: { foreground: "#c13838" } },
      { scope: "operator", settings: { foreground: "#c9a022" } },
      { scope: "delimiter", settings: { foreground: "#6a727d" } },
      { scope: "tag", settings: { foreground: "#3398db" } },
      { scope: "attribute.name", settings: { foreground: "#c9a022" } },
      { scope: "attribute.value", settings: { foreground: "#37ae6f" } },
    ],
    colors: {
      "editor.background": "#181a1f",
      "editor.foreground": "#a2abb6",
      "editorLineNumber.foreground": "#3b4048",
      "editorLineNumber.activeForeground": "#a2abb6",
      "editorCursor.foreground": "#c9a022",
      "editor.selectionBackground": "#a2abb630",
      "editor.inactiveSelectionBackground": "#a2abb620",
      "editorIndentGuide.background1": "#252830",
      "editorIndentGuide.activeBackground1": "#3b4048",
      "editor.lineHighlightBackground": "#1d2025",
      "editorBracketMatch.background": "#a2abb630",
      "editorBracketMatch.border": "#c9a022",
    },
  },
  "Bearded Vivid Black": {
    name: "bearded-vivid-black",
    type: "dark",
    fg: "#d4d4d4",
    bg: "#121212",
    settings: [
      { settings: { foreground: "#d4d4d4", background: "#121212" } },
      { scope: "keyword", settings: { foreground: "#ff79c6" } },
      { scope: "keyword.control", settings: { foreground: "#ff79c6" } },
      { scope: "type", settings: { foreground: "#8be9fd" } },
      { scope: "type.identifier", settings: { foreground: "#50fa7b" } },
      { scope: "string", settings: { foreground: "#f1fa8c" } },
      { scope: "string.escape", settings: { foreground: "#ffb86c" } },
      { scope: "comment", settings: { foreground: "#6272a4", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#50fa7b" } },
      { scope: "variable", settings: { foreground: "#ff6e6e" } },
      { scope: "variable.parameter", settings: { foreground: "#ffb86c" } },
      { scope: "number", settings: { foreground: "#bd93f9" } },
      { scope: "constant", settings: { foreground: "#bd93f9" } },
      { scope: "operator", settings: { foreground: "#ff79c6" } },
      { scope: "delimiter", settings: { foreground: "#6272a4" } },
      { scope: "tag", settings: { foreground: "#8be9fd" } },
      { scope: "attribute.name", settings: { foreground: "#50fa7b" } },
      { scope: "attribute.value", settings: { foreground: "#f1fa8c" } },
    ],
    colors: {
      "editor.background": "#121212",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#3b3b3b",
      "editorLineNumber.activeForeground": "#d4d4d4",
      "editorCursor.foreground": "#ff79c6",
      "editor.selectionBackground": "#6272a450",
      "editor.inactiveSelectionBackground": "#6272a430",
      "editorIndentGuide.background1": "#2a2a2a",
      "editorIndentGuide.activeBackground1": "#3b3b3b",
      "editor.lineHighlightBackground": "#1a1a1a",
      "editorBracketMatch.background": "#6272a450",
      "editorBracketMatch.border": "#50fa7b",
    },
  },

  // ===========================================================================
  // Invert IDE App Themes
  // ===========================================================================
  "Graphite Dusk": {
    name: "graphite-dusk",
    type: "dark",
    fg: "#d2d0d6",
    bg: "#1e1d20",
    settings: [
      { settings: { foreground: "#d2d0d6", background: "#1e1d20" } },
      { scope: "keyword", settings: { foreground: "#c586c0", fontStyle: "bold" } },
      { scope: "keyword.control", settings: { foreground: "#c586c0" } },
      { scope: "type", settings: { foreground: "#4ec9b0" } },
      { scope: "type.identifier", settings: { foreground: "#4ec9b0" } },
      { scope: "string", settings: { foreground: "#ce9178" } },
      { scope: "string.escape", settings: { foreground: "#d7ba7d" } },
      { scope: "comment", settings: { foreground: "#626068", fontStyle: "italic" } },
      { scope: "function", settings: { foreground: "#dcdcaa" } },
      { scope: "variable", settings: { foreground: "#b8b4ea" } },
      { scope: "variable.parameter", settings: { foreground: "#b8b4ea" } },
      { scope: "number", settings: { foreground: "#b5cea8" } },
      { scope: "constant", settings: { foreground: "#a4a0e0" } },
      { scope: "operator", settings: { foreground: "#d2d0d6" } },
      { scope: "delimiter", settings: { foreground: "#82808a" } },
      { scope: "tag", settings: { foreground: "#a4a0e0" } },
      { scope: "attribute.name", settings: { foreground: "#b8b4ea" } },
      { scope: "attribute.value", settings: { foreground: "#ce9178" } },
    ],
    colors: {
      "editor.background": "#1e1d20",
      "editor.foreground": "#d2d0d6",
      "editorLineNumber.foreground": "#58545e",
      "editorLineNumber.activeForeground": "#d2d0d6",
      "editorCursor.foreground": "#a088c8",
      "editor.selectionBackground": "#a088c840",
      "editor.inactiveSelectionBackground": "#a088c825",
      "editorIndentGuide.background1": "#323036",
      "editorIndentGuide.activeBackground1": "#3c3a42",
      "editor.lineHighlightBackground": "#252428",
      "editorBracketMatch.background": "#a088c830",
      "editorBracketMatch.border": "#a088c8",
    },
  },
};

export function getCodeEditorThemeName(displayName: string): string {
  return MonacoEditorThemes[displayName]?.name;
}
