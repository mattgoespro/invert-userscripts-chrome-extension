/** Matches TypeScript's module detection for declaration files closely enough
 * for UI purposes: a top-level `import`/`export` makes the file a module. */
export function isModuleDeclarationFile(contents: string): boolean {
  return /^\s*(?:export|import)\b/m.test(contents);
}

/**
 * Whether a userscript's types pane should be a Monaco `types.d.ts` model.
 *
 * The active pane is always mounted (ambient when it has no import/export).
 * Offscreen panes are mounted only once they are modules, so their exports
 * can be imported / auto-imported from `scripts/<m>/types`.
 */
export function shouldMountTypesModel(options: {
  isActive: boolean;
  typeDefinitions: string;
}): boolean {
  return options.isActive || isModuleDeclarationFile(options.typeDefinitions);
}

/**
 * Unwraps `declare global { ... }` blocks so the inner declarations can live
 * in a non-module extra lib. `declare global` is only valid in modules, but
 * the ambient copy has its `export {}` stripped.
 */
export function unwrapDeclareGlobalBlocks(contents: string): string {
  const prefix = /declare\s+global\s*\{/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = prefix.exec(contents)) !== null) {
    result += contents.slice(lastIndex, match.index);

    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let index = bodyStart;

    for (; index < contents.length && depth > 0; index++) {
      const character = contents[index];

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
      }
    }

    if (depth !== 0) {
      result += contents.slice(match.index);
      return result;
    }

    result += contents.slice(bodyStart, index - 1);
    lastIndex = index;
    prefix.lastIndex = index;
  }

  result += contents.slice(lastIndex);
  return result;
}

/**
 * Strips top-level `export` keywords from type definition content before
 * registering it as an ambient (globally-visible) extra lib.
 *
 * A `.d.ts` file containing any top-level `export` is a module — its
 * declarations become module-scoped and require an explicit `import`.
 * The stripped ambient copy keeps them globally visible as well, matching the
 * long-standing behavior where a script's type pane declares page globals.
 * The real `types.d.ts` model still carries the exports, so
 * `import type { X } from "scripts/<m>/types"` resolves normally.
 */
export function stripExportsForAmbientLib(typeDefinitions: string): string {
  const stripped = typeDefinitions
    // Strip `export` from named declarations: `export type X` → `type X`.
    // The negative lookahead prevents `export type { X }` from being matched
    // here; that form is a re-export and is removed by the next rule.
    .replace(
      /^export\s+(type(?!\s*\{)|interface|const|let|var|function|class|enum|declare|abstract)\b/gm,
      "$1"
    )
    // Remove named re-exports: `export { X }`, `export type { X }`,
    // `export { X } from '...'`, `export type { X } from '...'`.
    .replace(
      /^export\s*(?:type\s+)?\{[^}]*\}(?:\s*from\s*["'][^"']*["'])?\s*;?\s*$/gm,
      ""
    )
    // Remove namespace re-exports: `export * from '...'`, `export * as X from '...'`.
    .replace(
      /^export\s*\*(?:\s*as\s+\w+)?\s*from\s*["'][^"']*["']\s*;?\s*$/gm,
      ""
    );

  return unwrapDeclareGlobalBlocks(stripped);
}

const DECLARE_GLOBAL = /\bdeclare\s+global\b/;

/**
 * Whether to register a stripped extra-lib copy of a type pane.
 *
 * A modeled non-module `types.d.ts` is already a page global. A modeled
 * `export type` pane is a module, so the extra lib is what makes those names
 * visible in `script.ts` without an import — including the active script.
 * `declare global` + `export {}` already leaks via the model; copying it would
 * duplicate identifiers.
 */
export function shouldPublishAmbientTypeLib(options: {
  shared: boolean;
  typesModeled: boolean;
  typeDefinitions: string;
}): boolean {
  if (!options.typesModeled) {
    return options.shared;
  }

  if (!isModuleDeclarationFile(options.typeDefinitions)) {
    return false;
  }

  if (DECLARE_GLOBAL.test(options.typeDefinitions)) {
    return false;
  }

  return true;
}
