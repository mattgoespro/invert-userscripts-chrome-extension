---
description: "Scaffold a new example userscript with the correct file structure, global type declarations, ESLint directives, and tsconfig inclusion."
argument-hint: "ScriptName [--shared]"
agent: "agent"
---

Create a new example userscript in `examples/userscripts/` following the global script conventions from [example-userscripts.instructions.md](../instructions/example-userscripts.instructions.md).

## Input

The user provides:

- **Script name** (kebab-case, e.g., `video-downloader`, `page-highlighter`)
- **`--shared`** flag (optional) — if present, this script exposes global API for other scripts to consume

## Files to Create

### Always: `{script-name}.ts`

The implementation file. No `export` or `import` statements.

```typescript
/* eslint-disable @typescript-eslint/no-unused-vars -- global API */

// Implementation here
```

- Add the ESLint disable directive at the top if the script has globally-available declarations
- Consumer scripts (non-shared, self-contained) do **not** need the directive

### If `--shared`: `{script-name}.global.d.ts`

The global type declaration file exposing the script's public API:

```typescript
declare global {
  // Types and function signatures here
}

export {};
```

- Use `declare global` to augment the global scope
- End with `export {};` (required to make the file a module)
- Only declare the **public API** — internal helpers stay undeclared
- The `.global.d.ts` suffix is required to avoid TypeScript ignoring it when a same-name `.ts` file exists

## Conventions

- All top-level functions and variables are globally available at runtime
- Use types from other `.global.d.ts` files freely — they're all included via tsconfig
- Internal/private helper functions should be prefixed with `_` (e.g., `_parseInput`)
- Use `window.log` (type `Logger`) for logging — declared in `modules.d.ts`
