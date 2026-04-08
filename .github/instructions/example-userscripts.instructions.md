---
applyTo: "examples/userscripts/**"
description: "Use when working with example userscripts: global script patterns, per-script .global.d.ts type declarations, no-module architecture, ESLint directives for unused global functions."
---

# Example Userscripts

The `examples/userscripts/` directory contains standalone userscript examples that demonstrate the patterns used in Invert IDE's script injection system. These scripts run in the browser's global scope — they do **not** use ES module imports/exports.

## Global Script Architecture

Each userscript is a plain `.ts` file that declares functions and variables at the top level. At runtime, these are injected into web pages via `chrome.scripting.executeScript` into the `MAIN` world, making all top-level declarations globally available.

**No `export` or `import` statements** — scripts are not modules.

## Type Declarations

Shared scripts expose their public API via a companion `.global.d.ts` file using `declare global`:

```text
pretty-stringify.ts          ← Implementation (no exports)
pretty-stringify.global.d.ts ← Global type declarations
```

### `.global.d.ts` Pattern

```typescript
declare global {
  type MyOptions = { /* ... */ };
  function myFunction(arg: string, options?: MyOptions): string;
}

export {};
```

- **`declare global`** augments the global scope so all scripts see these types without imports.
- **`export {};`** at the bottom is required — it makes the `.d.ts` file a module so `declare global` is valid. It produces no runtime output.
- **`.global.d.ts` suffix** is required — if the `.d.ts` shares the same base name as a `.ts` file (e.g., `foo.d.ts` + `foo.ts`), TypeScript ignores the `.d.ts` entirely.

### Special Declaration Files

- **`modules.d.ts`** — Declares global `Window` augmentations and external library shims (e.g., `rxjs.Subject`) that apply across all scripts.

## ESLint Configuration

Since top-level function declarations are intentionally "unused" within their own file (they're consumed globally by other scripts at runtime), ESLint's `@typescript-eslint/no-unused-vars` is suppressed per-file:

- **File-level disable** — For shared utility scripts where most/all declarations are global API:
  ```typescript
  /* eslint-disable @typescript-eslint/no-unused-vars -- global API */
  function myGlobalFunction() { /* ... */ }
  ```

- **Scoped disable/enable** — When only some declarations are global and internal helpers should still be checked:
  ```typescript
  function _internalHelper() { /* ... */ }

  /* eslint-disable @typescript-eslint/no-unused-vars -- global API */
  function globalFunction() { /* ... */ }
  /* eslint-enable @typescript-eslint/no-unused-vars */
  ```

## tsconfig.json

The `examples/userscripts/tsconfig.json` includes `["*.ts", "*.d.ts"]` so all `.global.d.ts` declarations are visible to every script without explicit references.
