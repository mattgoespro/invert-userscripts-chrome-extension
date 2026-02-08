# Copilot Instructions

## Project Overview

**Invert IDE** is a Chrome extension (Manifest V3) that provides an integrated TypeScript/SCSS IDE directly in the browser. Users can write, manage, and inject JavaScript userscripts with a Monaco editor, combining development tooling with script injection capabilities. The extension compiles TypeScript and SCSS in-browser, formats code with Prettier, and programmatically injects compiled scripts into matching web pages.

---

## Architecture & Monorepo Structure

The project follows a monorepo architecture with three distinct packages:

| Package             | Purpose                                                       | Key Technologies                                                |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/renderer` | React-based UI for the Options page (IDE) and extension Popup | TypeScript, React 19, React Redux, Redux Toolkit, Monaco Editor |
| `packages/runtime`  | Background service workers and content scripts                | TypeScript, Chrome Extensions API                               |
| `packages/shared`   | Common types, storage wrappers, and message definitions       | TypeScript                                                      |

### Package Dependencies

```
packages/renderer ──→ packages/shared
packages/runtime  ──→ packages/shared
packages/shared   ──→ packages/renderer/src/sandbox/compiler.ts (cross-package re-export)
```

> **Note**: `packages/shared/src/index.ts` re-exports compiler classes from the renderer package. This is intentional so that both `runtime` and `renderer` can import `TypeScriptCompiler` and `SassCompiler` via `@shared/*`.

---

## Key Developer Workflows

### Build & Run

| Command                        | Description                               |
| ------------------------------ | ----------------------------------------- |
| `npm run dev`                  | Run Webpack in watch mode for development |
| `npm run build`                | Production build                          |
| `npm run lint`                 | Run ESLint across all packages and tools  |
| `npm run format`               | Run Prettier to format all files          |
| `npm run clean`                | Remove the `dist` directory               |
| `npm run icons`                | Generate extension icons via `scripts/`   |
| `npm run start-redux-devtools` | Launch Redux DevTools on localhost:8001   |

### Path Aliases

- `@shared/*` → Maps to `packages/shared/src/*`. Use for importing shared logic across packages.
- `@/*` → Maps to `./src/*` within the renderer package (e.g., `@/shared/components` → `packages/renderer/src/shared/components`).
- `@assets/styles/invert-ide` → Maps to the main SCSS entry file (`packages/renderer/src/assets/styles/_index.scss`).

---

## Data Models

Core data types are defined in `packages/shared/src/model.ts`:

### Userscript

The central data type. Each userscript stores both source and compiled code:

```typescript
type Userscript = {
  id: string;
  name: string;
  enabled: boolean;
  status: "modified" | "saved";
  code: {
    source: { typescript: string; scss: string };
    compiled: { javascript: string; css: string };
  };
  urlPatterns: string[];
  runAt: string;
  createdAt: string;
  updatedAt: string;
};

type Userscripts = Record<string, Userscript>;
```

### Other Models

- **`GlobalModule`**: External JavaScript modules (`{ id, name, url, enabled }`) that can be injected globally.
- **`GlobalModules`**: `Record<string, GlobalModule>`.
- **`EditorSettings`**: Monaco editor configuration (`{ theme, fontSize, tabSize, autoFormat, autoSave }`).
- **`CompileResult`**: Compilation output (`{ success, code?, error? }`).
- **`EditorTheme`**: Monaco theme descriptor (`{ id, name, theme }`).

---

## State Management & Persistence

### Storage Strategy

All persistence is handled via `chrome.storage.sync`, abstracted by `StorageManager` in `packages/shared/src/storage.ts`.

**`StorageManager` API** (all static methods):

| Method                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `getAll()`                     | Returns all stored data                    |
| `getAllScripts()`              | Returns `Userscripts` record               |
| `saveScript(script)`           | Merges script into storage                 |
| `updateScript(id, updates)`    | Partial update with debug logging          |
| `deleteScript(scriptId)`       | Removes a script                           |
| `getAllModules()`              | Returns `GlobalModules` record             |
| `saveModule(module)`           | Upserts a module                           |
| `deleteModule(moduleId)`       | Removes a module                           |
| `getEditorSettings()`          | Returns settings (with hardcoded defaults) |
| `saveEditorSettings(settings)` | Merges partial settings                    |

### Hybrid State Patterns

| State Type                    | Pattern                                                              | Example                                    |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| **Userscripts** (complex)     | Redux Toolkit slices + `createAsyncThunk` for async storage          | `shared/store/slices/userscripts.slice.ts` |
| **Editor Settings** (complex) | Redux Toolkit slices + `createAsyncThunk` for async storage          | `shared/store/slices/settings.slice.ts`    |
| **Global Modules** (simple)   | Direct `StorageManager` access with `useState` and manual `loadData` | `ModulesPage` component                    |

### Redux Store Configuration

The store is configured in `packages/renderer/src/shared/store/store.ts`:

- **Two slices**: `userscripts` and `settings`
- **Middleware**: `redux-logger` (collapsed, diff mode)
- **DevTools**: Named `"Invert IDE Userscripts"`
- **No epics / no Redux Observable** — all async operations use `createAsyncThunk`

### Typed Redux Hooks

Always use the typed hooks from `packages/renderer/src/shared/store/hooks.ts`:

```tsx
import { useAppDispatch, useAppSelector, useAppStore } from "@/shared/store/hooks";
```

### Redux Flow for Userscripts

The `userscripts.slice.ts` defines:

**Async Thunks** (6): `loadUserscripts`, `createUserscript`, `deleteUserscript`, `toggleUserscript`, `updateUserscript`, `updateUserscriptCode`

**Sync Reducers** (2): `setCurrentUserscript`, `markUserscriptModified` (both use `prepare` callback to wrap bare IDs)

**Selectors** (4): `selectAllUserscripts`, `selectCurrentUserscript`, `selectUserscriptById`, `selectUnsavedUserscripts`

Flow:

1. Component dispatches an async thunk (e.g., `updateUserscriptCode`)
2. Thunk performs async work (compilation, storage persistence via `StorageManager`)
3. `extraReducers` handles `pending`/`fulfilled`/`rejected` states
4. Selectors provide derived access to state

### Redux Flow for Settings

The `settings.slice.ts` defines:

**Async Thunks** (7): `loadSettings`, `updateTheme`, `updateFontSize`, `updateTabSize`, `updateAutoFormat`, `updateAutoSave`, `updateSettings`

**Sync Reducers** (5): `setTheme`, `setFontSize`, `setTabSize`, `setAutoFormat`, `setAutoSave`

**Pattern**: Each setting has both a sync reducer (optimistic UI update) and an async thunk (persistent storage). The `loadSettings` thunk also tracks `isLoading` state.

---

## Component & Styling Guidelines

### UI Components

Use the custom component library in `packages/renderer/src/shared/components`:

| Component       | Purpose                            | Import Path                                        |
| --------------- | ---------------------------------- | -------------------------------------------------- |
| `Button`        | Standard buttons                   | `@/shared/components/button/Button`                |
| `IconButton`    | Icon-only buttons (Lucide icons)   | `@/shared/components/icon-button/IconButton`       |
| `Input`         | Text inputs                        | `@/shared/components/input/Input`                  |
| `Select`        | Dropdown selects                   | `@/shared/components/select/Select`                |
| `Checkbox`      | Checkboxes                         | `@/shared/components/checkbox/Checkbox`            |
| `Switch`        | Toggle switches                    | `@/shared/components/switch/Switch`                |
| `Typography`    | Text elements with variant styling | `@/shared/components/typography/Typography`        |
| `CodeComment`   | Code-styled `//` comment display   | `@/shared/components/code-comment/CodeComment`     |
| `ResizeHandle`  | Drag-to-resize handler             | `@/shared/components/resize-handle/ResizeHandle`   |
| `ErrorBoundary` | Error boundary fallback UI         | `@/shared/components/error-boundary/ErrorBoundary` |

**Do NOT use raw HTML elements** (e.g., `<button>`, `<input>`) when a custom component exists.

| Instead of... | Use...                           |
| ------------- | -------------------------------- |
| `<button>`    | `<Button>`                       |
| `<input>`     | `<Input>`                        |
| `<select>`    | `<Select>`                       |
| `<h1>`, `<p>` | `<Typography variant="...">`     |
| Icon button   | `<IconButton icon={LucideIcon}>` |

Import examples:

```tsx
import { Button } from "@/shared/components/button/Button";
import { Input } from "@/shared/components/input/Input";
import { Typography } from "@/shared/components/typography/Typography";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
```

### Additional Shared Exports

- `CodeEditorThemes.ts` — 17 Monaco editor themes (Invert Dark, VS Code Dark, Material Darker, Monokai, GitHub Dark, Darcula, etc.) with registration and lookup utilities.
- `utils.ts` — Re-exports `uuid` from the `uuid` package: `export { v4 as uuid } from "uuid"`.

---

## Component Implementation Patterns

### File Structure

Every component MUST follow this structure:

```
component-name/
  ComponentName.tsx
  ComponentName.scss
```

- **Folder naming**: `kebab-case` (e.g., `icon-button/`, `script-editor/`)
- **File naming**: `PascalCase` for TSX (e.g., `IconButton.tsx`), matching `PascalCase.scss` for styles

### React Component Pattern

Follow this exact structure for all components:

```tsx
import "./ComponentName.scss";

type ComponentNameProps = {
  variant?: "primary" | "secondary";
  // ... other props
} & React.HTMLAttributes<HTMLDivElement>; // Extend native attributes when applicable

export function ComponentName({ variant = "primary", ...rest }: ComponentNameProps) {
  return (
    <div className={`component-name component-name--${variant}`} {...rest}>
      {/* content */}
    </div>
  );
}
```

**Key Patterns**:

1. **SCSS import first** — Always import the component's SCSS file at the top
2. **Props type definition** — Define a `ComponentNameProps` type, extending native HTML attributes when appropriate
3. **Named export** — Use named exports (not default exports) for components
4. **Spread rest props** — Pass through additional HTML attributes via `...rest`
5. **Double quotes** — Always use double quotes for strings and JSX attributes
6. **`forwardRef` when needed** — Use `forwardRef` for components that expose a DOM ref (see `CodeComment` for example)

---

## SCSS Design Token System

### Architecture Overview

The styling system uses a **3-tier design token pipeline** defined in `packages/renderer/src/assets/styles/`. All tokens are CSS custom properties on `:root`, imported once at the app root via `_index.scss`.

```
_primitives.scss  →  _semantic.scss  →  _components.scss
   (raw values)      (intent aliases)    (component contracts)
                  ↘                    ↗
                    _typography.scss
                    _mixins.scss
```

> **Important**: `_index.scss` is imported once in `options/index.tsx`. **Do NOT import any style token file directly into React components** — the CSS variables are globally available via `var()` syntax.

### Tier 1: Primitives (`_primitives.scss`)

Raw design values. All prefixed with `--base-*`. **Never reference these directly in components.**

| Category            | Examples                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| Core palette        | `--base-black`, `--base-blue`, `--base-orange`                           |
| Surfaces            | `--base-surface-base`, `--base-surface-raised`, `--base-surface-overlay` |
| Glass effects       | Semi-transparent backgrounds and borders                                 |
| Text opacity        | `--base-text-muted-faint`, `--base-text-muted`                           |
| Accent glow         | Orange-based, 4 intensity levels                                         |
| Shadows             | `--base-shadow-soft`, `--base-shadow-default`, `--base-shadow-heavy`     |
| Error states        | 8 variables for error UI                                                 |
| Syntax highlighting | `--base-syntax-keyword`, `--base-syntax-function`, etc.                  |

Also defines SCSS variables (`$black`, `$white`, `$blue`, `$orange`, etc.) used for `color.scale()` transformations within the same file.

### Tier 2: Semantic Tokens (`_semantic.scss`)

Intent-driven aliases referencing `--base-*` primitives. **These are the primary tokens for component styling.**

| Category    | Variables                                                       |
| ----------- | --------------------------------------------------------------- |
| Core        | `--primary`, `--secondary`, `--accent`, `--danger`              |
| Layout      | `--background`, `--foreground`, `--border`                      |
| Surfaces    | `--surface-base`, `--surface-raised`, `--surface-overlay`       |
| Glass       | `--glass-background-*`, `--glass-border-*` (soft/default/heavy) |
| Text        | `--text-muted-faint`, `--text-muted`, `--text-muted-strong`     |
| Accent glow | `--accent-glow-faint/soft/default/strong`                       |
| Status      | `--info`, `--warning`, `--error`                                |
| Geometry    | `--geometry-border-radius: 6px`                                 |

### Tier 3: Component Tokens (`_components.scss`)

Themeable tokens that form the styling contract for each UI component:

- **Input**: `--input-foreground`, `--input-background`, `--input-border`, `--input-placeholder`
- **Label**: `--label-foreground`
- **Button**: `--button-foreground`, `--button-background`, `--button-hover-*`, `--button-active-*`, `--button-disabled-*`
- **Icon Button**: `--icon-button-foreground`, `--icon-button-background`, `--icon-button-border`, `--icon-button-hover`, `--icon-button-focus`
- **Switch**: `--switch-foreground`, `--switch-background`, `--switch-checked-*`, `--switch-border-*`
- **Select**: `--select-foreground`, `--select-background`, `--select-border`, `--select-placeholder`
- **Checkbox**: `--checkbox-foreground`, `--checkbox-background`, `--checkbox-border`, `--checkbox-checked-*`
- **Typography**: `--title-foreground`, `--subtitle-foreground`

### Typography Tokens (`_typography.scss`)

**Font Families** (exposed as CSS variables):

| Variable         | Font Stack                          | Usage                         |
| ---------------- | ----------------------------------- | ----------------------------- |
| `--font-heading` | `"Outfit", "Open Sans", sans-serif` | Headings                      |
| `--font-body`    | `"Open Sans", sans-serif`           | Body text                     |
| `--font-mono`    | `"JetBrains Mono", monospace`       | Code, inputs, buttons, labels |

**Typography Variants** (8 variants, each with `font-family`, `font-size`, `font-weight`, `line-height`, `color`):

| Variant    | Font           | Size     | Weight |
| ---------- | -------------- | -------- | ------ |
| `title`    | Outfit         | 1.5rem   | 600    |
| `subtitle` | Outfit         | 1.25rem  | 500    |
| `body`     | Open Sans      | 0.875rem | 400    |
| `caption`  | Open Sans      | 0.75rem  | 400    |
| `button`   | JetBrains Mono | 0.875rem | 500    |
| `input`    | JetBrains Mono | 0.875rem | 400    |
| `label`    | JetBrains Mono | 0.75rem  | 500    |
| `code`     | JetBrains Mono | 0.875rem | 400    |

Access via: `var(--typography-{variant}-font-size)`, `var(--typography-{variant}-font-weight)`, etc.

### Global Mixins (`_mixins.scss`)

| Mixin          | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `grid-pattern` | Creates a 24×24px decorative grid background using `--grid-line`            |
| `focus-ring`   | Applies `:focus-visible` outline with `--accent-glow` border and box-shadow |

---

## SCSS Styling Patterns

### Styling Basics

- Import SCSS files directly into components: `import "./Component.scss"`
- **CSS Modules are NOT used** — use global SCSS with scoped class naming
- **Never import token files** (`_primitives.scss`, `_semantic.scss`, etc.) directly in components — they are globally available

### Class Naming Convention

Use **BEM-inspired double-dash syntax** for class names:

```scss
// Block
.component-name {
}

// Block with modifier
.component-name--variant {
}

// Block with element (nested)
.component-name {
  .component-name--element {
  }
}

// Alternative element syntax (also acceptable)
.component-name--wrapper {
  .component-name--label {
  }
  .component-name--field {
  }
}
```

**Examples from the codebase**:

- `.input--wrapper`, `.input--label`, `.input--field`
- `.select--wrapper`, `.select--label`, `.select--field`
- `.switch--wrapper`, `.switch--input`, `.switch--slider`
- `.icon-btn--primary`, `.icon-btn--secondary`
- `.typography--title`, `.typography--subtitle`
- `.script-list-item--wrapper`, `.script-list-item--name`
- `.resize-handle`, `.resize-handle--horizontal`, `.resize-handle--dragging`

### CSS Variables Usage

**ALWAYS use CSS variables** from the design token system. Never hardcode colors, typography, or geometry values.

```scss
// ✅ CORRECT - Use semantic and component tokens
.my-component {
  color: var(--foreground);
  background-color: var(--input-background);
  font-family: var(--typography-input-font-family);
  font-size: var(--typography-input-font-size);
  border-radius: var(--geometry-border-radius);
  border: 1px solid var(--border);
}

// ✅ CORRECT - Glass-morphism effect using tokens
.my-overlay {
  background: var(--glass-background-default);
  border: 1px solid var(--glass-border-default);
  backdrop-filter: blur(12px);
}

// ❌ WRONG - Hardcoded values
.my-component {
  color: #f0f0f0;
  background-color: #2d2d2d;
  font-family: "Nunito Sans";
  border-radius: 6px;
}
```

**Token Reference Priority** (prefer higher tiers):

1. **Component tokens** (`--input-background`, `--button-hover-background`) — most specific
2. **Semantic tokens** (`--primary`, `--foreground`, `--surface-raised`) — intent-based
3. **Primitive tokens** (`--base-*`) — avoid using directly in components

### SCSS Best Practices

```scss
// 1. Use SCSS nesting for element scoping
.component--wrapper {
  display: flex;

  .component--label {
    color: var(--label-foreground);
    text-transform: uppercase;
  }

  .component--field {
    background-color: var(--input-background);
  }
}

// 2. Use & for pseudo-classes and modifiers
.button {
  background: var(--button-background);
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--button-hover-background);
  }

  &:disabled {
    background: var(--button-disabled-background);
    cursor: not-allowed;
  }

  &--primary {
    /* variant styles */
  }
  &--secondary {
    /* variant styles */
  }
}

// 3. Define SCSS variables for repeated values
$transition-duration: 0.2s;

.switch--slider {
  transition: $transition-duration;
}

// 4. Use @mixin for reusable style blocks
@mixin icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.icon-btn--primary {
  @include icon-btn;
}

// 5. Glass-morphism pattern (used extensively)
.my-card {
  background: var(--glass-background-default);
  border: 1px solid var(--glass-border-default);
  backdrop-filter: blur(12px);
  border-radius: var(--geometry-border-radius);
  box-shadow: var(--shadow-default);
}
```

### Important SCSS Rules

1. **Never import token SCSS files** directly in components — CSS variables are globally available
2. **Use `rem` units** for sizing (not `px`) when possible
3. **Keep transitions short** — 0.2s to 0.3s for interactive elements
4. **Scope all styles** under a component-specific class to avoid conflicts
5. **Use glass-morphism** (`backdrop-filter: blur()` + glass tokens) for card/overlay backgrounds

---

## Design Aesthetic Guidelines

### Typography

The design system uses **Outfit** for headings, **Open Sans** for body text, and **JetBrains Mono** for code, inputs, buttons, and labels. Ensure:

- Proper hierarchy with `Typography` variants (`title`, `subtitle`, `body`, `caption`)
- Uppercase labels with `text-transform: uppercase` for form labels
- JetBrains Mono for all interactive/code-related text
- Appropriate font weights from the typography scale

### Color & Theme

The palette is **dark-themed** with:

- Dark backgrounds (`--surface-base`, `--surface-raised`, `--surface-overlay`)
- Light foregrounds (`--foreground`)
- **Orange accent** (`--accent`) for primary actions and highlights
- **Blue primary** (`--primary`) for interactive elements
- **Glass effects** for layered UI depth

Use the established color tokens; do not introduce new colors without updating the design token system.

### Glass-Morphism Pattern

A core design pattern used throughout the UI for cards, overlays, headers, and panels:

```scss
.glass-card {
  background: var(--glass-background-default);
  border: 1px solid var(--glass-border-default);
  backdrop-filter: blur(12px);
  border-radius: var(--geometry-border-radius);
  box-shadow: var(--shadow-default);
}
```

Glass intensity levels available: `soft`, `default`, `heavy`, `white`, `strong`.

### Code-Style CSS Decorations

The IDE aesthetic uses code-syntax-inspired visual elements throughout the UI:

- `//` comment prefix before section headers (via `::before` pseudo-elements with `content: "//"`)
- `const` keyword decoration before field labels
- `import { ... } from 'cdn'` styling on module cards
- `: string[]` type annotation styling on URL pattern fields
- Syntax-highlighted code snippets in the dashboard header

These decorations use JetBrains Mono font and syntax highlighting tokens (`--syntax-keyword`, `--syntax-function`, etc.).

### Motion & Interaction

Apply subtle, purposeful animations:

```scss
// Smooth state transitions
transition: background-color 0.2s ease;

// Staggered reveal for list items
@keyframes item-reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.list-item {
  animation: item-reveal 0.3s ease forwards;
  animation-delay: calc(var(--index) * 0.05s); // staggered
}

// Pulse indicator for unsaved state
@keyframes pulse-indicator {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

// Ambient glow effects
@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.6;
  }
}
```

### Visual Depth

Create atmosphere with:

- Glass-morphism backgrounds using `--glass-*` tokens
- Subtle borders with `--glass-border-*` tokens
- Backdrop blur for overlay effects (`backdrop-filter: blur(12px)`)
- Ambient glow effects using `--accent-glow-*` tokens
- Layered shadows (`--shadow-soft/default/heavy`)
- Decorative grid patterns via `@include grid-pattern`

---

## Sandbox Architecture (Compilation & Formatting)

The `packages/renderer/src/sandbox/` directory contains the in-browser compilation and formatting system.

### TypeScript Compilation

`TypeScriptCompiler` (static class in `compiler.ts`) wraps `typescript.transpileModule()` directly:

- Target: ES2020, Module: ESNext
- Strict mode enabled
- Returns `CompileResult` (`{ success, code?, error? }`)

### SCSS Compilation

`SassCompiler` (class in `compiler.ts`) uses a **sandboxed iframe** pattern to bypass Chrome Extension CSP restrictions:

1. A hidden iframe loads `sass-sandbox.html` (declared in `manifest.json` under `sandbox`)
2. The sandbox page has relaxed CSP allowing `unsafe-eval` (required by dart-sass)
3. `SassCompiler.initialize()` lazily creates the iframe and waits for `"sandbox-ready"` message
4. Compilation requests use `postMessage` to the iframe, which runs `sass.compileString()`
5. Results are posted back with a 10-second timeout per compilation

### Code Formatting

`PrettierFormatter` (static class in `formatter.ts`) wraps Prettier's standalone browser API:

- Supports `"typescript"` and `"scss"` languages
- Uses TypeScript, PostCSS, and Estree parser plugins
- Applies the project's Prettier config (double quotes, trailing commas, 100 char width)
- Returns original code on failure (graceful degradation)

### Sandbox Files

| File                | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `compiler.ts`       | `TypeScriptCompiler` + `SassCompiler` classes |
| `formatter.ts`      | `PrettierFormatter` class                     |
| `sass-sandbox.ts`   | Iframe-side listener for SCSS compilation     |
| `sass-sandbox.html` | Sandboxed page with relaxed CSP for dart-sass |

---

## Communication Architecture

### Extension Messaging

All messaging is type-safe via definitions in `packages/shared/src/messages.ts`:

- **`RuntimePortMessagePayloads`** — Maps message names to payload types. Currently: `{ refreshTabs: never }`.
- **`RuntimePortMessageName`** — Union of valid message names.
- **`RuntimePortMessageSource`** — Valid message sources: `"background"`, `"options"`, `"popup"`, `"content-script"`.
- **`RuntimePortMessageEvent<T>`** — Conditional type: if payload is `never`, message is `{ source, type }` only; otherwise includes `{ source, type, data }`.
- **`isRuntimePort(name)`** — Type guard for valid source names.

### Message Handlers

Located in `packages/runtime/src/handlers/`:

| Handler                 | Listens To                         | Action                                     |
| ----------------------- | ---------------------------------- | ------------------------------------------ |
| `runtime.handler.ts`    | `chrome.runtime.onInstalled`       | Logs installation                          |
| `runtime.handler.ts`    | `chrome.runtime.onMessage`         | Handles `"refreshTabs"` → injects scripts  |
| `navigation.handler.ts` | `chrome.webNavigation.onCompleted` | Main-frame only → injects matching scripts |
| `tab.handler.ts`        | `chrome.tabs.onUpdated`            | Tab loading → injects matching scripts     |

### Script Injection

The core injection logic lives in `packages/runtime/src/ide/scripts.ts`:

1. **`injectMatchingScripts(tabId, url)`** — Fetches enabled scripts from storage, filters by URL pattern match, injects each
2. **`matchesUrlPattern(url, patterns)`** — Converts glob patterns (`*`, `?`) to regex and tests against URL
3. **`injectScript(tabId, script)`** — Uses `chrome.scripting.executeScript` with `world: "MAIN"` to inject compiled JavaScript via a dynamically created `<script>` element

Background script (`packages/runtime/src/background.ts`) registers the Chrome event listeners and delegates to handlers.

---

## Build System (Webpack)

### Entry Points

| Entry          | Source File                                     | Output            |
| -------------- | ----------------------------------------------- | ----------------- |
| `background`   | `packages/runtime/src/background.ts`            | `background.js`   |
| `popup`        | `packages/renderer/src/popup/index.tsx`         | `popup.js`        |
| `options`      | `packages/renderer/src/options/index.tsx`       | `options.js`      |
| `sass-sandbox` | `packages/renderer/src/sandbox/sass-sandbox.ts` | `sass-sandbox.js` |

### Module Processing

| Scope                         | Loader                                    | Config              |
| ----------------------------- | ----------------------------------------- | ------------------- |
| `packages/shared/src/*.ts`    | `esbuild-loader`                          | Shared tsconfig     |
| `packages/runtime/**/*.ts`    | `esbuild-loader`                          | Runtime tsconfig    |
| `packages/renderer/**/*.tsx?` | `ts-loader` (`transpileOnly`)             | Renderer tsconfig   |
| `.scss`                       | `style-loader → css-loader → sass-loader` |                     |
| `.css`                        | `style-loader → css-loader`               |                     |
| `.ttf`                        | `asset/resource`                          | Monaco editor fonts |

### Resolve Aliases

- `@` → `packages/renderer/src/`
- `@shared` → `packages/shared/src/`
- `@assets/styles/invert-ide` → main SCSS index
- `monaco-editor` → ESM editor API entry

### Plugins

- `HtmlWebpackPlugin` ×3 (popup, options, sass-sandbox)
- `MonacoEditorWebpackPlugin`
- `CopyWebpackPlugin` (manifest.json + images)
- `FaviconsWebpackPlugin`
- `ChromeExtensionReloaderWebpackPlugin` (development only — see Development Tooling)

### Chunk Splitting

Monaco editor and Sass are isolated into separate chunks to optimize loading.

---

## Chrome Extension Configuration

### Manifest V3 (`public/manifest.json`)

| Setting          | Value / Details                                      |
| ---------------- | ---------------------------------------------------- |
| Permissions      | `storage`, `activeTab`, `scripting`, `webNavigation` |
| Host Permissions | `<all_urls>`                                         |
| Background       | Service worker: `background.js`                      |
| Action           | Popup: `popup.html`                                  |
| Options          | `options.html` (opens in new tab)                    |
| Sandbox          | `sass-sandbox.html` (for WASM SCSS compilation)      |
| CSP (pages)      | Allows `wasm-unsafe-eval` for TS/SCSS compilation    |
| CSP (sandbox)    | Allows `unsafe-eval` for dart-sass                   |

**No `content_scripts` are declared** — all script injection is programmatic via `chrome.scripting.executeScript`.

---

## Development Tooling

### Chrome Extension Hot Reload

A custom WebSocket-based hot-reload system in `tools/`:

| File                                          | Purpose                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `chrome-extension-reloader-webpack-plugin.ts` | Webpack plugin: starts WS server, injects client, broadcasts `"reload"` on build |
| `chrome-extension-reloader-plugin-utils.ts`   | Logger, Chrome path resolver, client script loader                               |
| `chrome-extension-reloader-client.js`         | Client IIFE: listens for `"reload"`, saves/restores page state, refreshes        |

**How it works** (development mode only):

1. Plugin starts a WebSocket server (default port `8081`)
2. On compilation, injects the client script into all HTML assets
3. On build completion, broadcasts `"reload"` to all connected clients
4. Client saves scroll position + input values to `sessionStorage`, refreshes CSS links, then `location.reload()`
5. On page load, client restores saved state
6. Auto-reconnects on WebSocket close with 1s delay

---

## Code Quality & Linting

### ESLint Configuration

The project uses ESLint flat config with a shared base and package-specific extensions:

**Root Configuration** (`eslint.config.mjs`):

- TypeScript-ESLint recommended rules
- Global ignores: `node_modules/`, `dist/`
- Exports `base` object with `{ common, configureTsEslintConfig }` for per-package consumption

**Key Rules**:

| Rule                                 | Setting | Notes                               |
| ------------------------------------ | ------- | ----------------------------------- |
| `@typescript-eslint/no-unused-vars`  | `warn`  | Ignores variables prefixed with `_` |
| `@typescript-eslint/no-explicit-any` | `warn`  | Prefer explicit types               |
| `no-unused-vars`                     | `off`   | Deferred to TypeScript rule         |

**Package-Specific**:

- `packages/renderer`: Adds React plugin (`react/react-in-jsx-scope: off`), HTML ESLint plugin (`flat/recommended`), TypeScript-ESLint recommended
- `packages/runtime`: Standard TypeScript rules via `configureTsEslintConfig`
- `packages/shared`: Standard TypeScript rules via `configureTsEslintConfig`

### Prettier Configuration

Consistent code formatting is enforced via Prettier (`prettier.config.mjs`):

| Option          | Value   |
| --------------- | ------- |
| `semi`          | `true`  |
| `trailingComma` | `"es5"` |
| `singleQuote`   | `false` |
| `printWidth`    | `100`   |
| `tabWidth`      | `2`     |
| `useTabs`       | `false` |

### Agent Compliance Requirements

When generating or modifying code:

1. **Always use double quotes** for strings (not single quotes)
2. **Always include semicolons** at the end of statements
3. **Limit line length to 100 characters** — break long lines appropriately
4. **Use 2-space indentation** (no tabs)
5. **Include trailing commas** in multi-line arrays/objects (ES5 style)
6. **Prefix unused variables with `_`** to avoid lint warnings (e.g., `_unusedParam`)
7. **Avoid `any` types** — use explicit types or `unknown` with type guards
8. **Run `npm run lint`** mentally before suggesting code to ensure compliance

---

## TypeScript Configuration

### Composite Project Structure

The project uses TypeScript project references:

```
tsconfig.json (root — includes tools/, *.ts at root)
├── tsconfig.base.json (shared compiler options)
├── packages/shared/tsconfig.json (composite, references nothing)
├── packages/runtime/tsconfig.json (composite, references shared)
└── packages/renderer/tsconfig.json (composite, references shared)
```

### Key TypeScript Compiler Options

**Base Options** (`tsconfig.base.json`):

- **Target**: ES2020
- **Module**: ESNext with Node module resolution
- **Strict Mode**: Disabled at base level
- **noImplicitAny**: true
- **forceConsistentCasingInFileNames**: true
- **noImplicitThis**: true
- **esModuleInterop**: true
- **resolveJsonModule**: true
- **skipLibCheck**: true

**Renderer Package Additions**:

- **JSX**: `react-jsx`
- **Lib**: `es2020`, `dom`, `dom.iterable`
- **Types**: `chrome`, `react`, `react-dom`
- **Path Aliases**: `@/*` → `./src/*`, `@shared/*` → `../shared/src/*`

**Runtime Package Additions**:

- **Lib**: `es2020`, `dom`, `dom.iterable`
- **Types**: `node`, `chrome`
- **Path Aliases**: `@/*` → `./src/*`, `@shared/*` → `../shared/src/*`

**Shared Package**:

- **Lib**: `dom`, `dom.iterable`
- **Includes**: `src/**/*.ts` + `../renderer/src/sandbox/compiler.ts` (cross-package)

---

## File Organization

### Renderer Package Structure

```
packages/renderer/src/
├── assets/                     # Images and global styles
│   ├── images/
│   └── styles/
│       ├── _index.scss         # Token orchestrator (imported at app root)
│       ├── _primitives.scss    # Tier 1: Raw design values (--base-*)
│       ├── _semantic.scss      # Tier 2: Intent aliases (--primary, etc.)
│       ├── _components.scss    # Tier 3: Component tokens (--input-*, etc.)
│       ├── _typography.scss    # Typography variants and font families
│       └── _mixins.scss        # Shared mixins (grid-pattern, focus-ring)
├── options/                    # Options page (main IDE)
│   ├── index.html
│   ├── index.tsx               # Entry: ErrorBoundary → Provider → InvertIde
│   └── invert-ide/
│       ├── InvertIde.tsx       # Root IDE component
│       ├── InvertIde.scss
│       ├── components/
│       │   ├── code-editor/    # Monaco editor wrapper (CodeEditor.tsx)
│       │   ├── dashboard-header/ # Decorative banner with syntax-highlighted snippet
│       │   └── sidebar/        # Navigation sidebar + SidebarNavButton
│       └── pages/
│           ├── scripts-page/   # Script management + dual-pane editor
│           │   ├── ScriptsPage.tsx
│           │   ├── script-list/          # ScriptList + ScriptListItem
│           │   └── script-editor/        # ScriptEditor + ScriptMetadata
│           ├── modules-page/   # Global module management (direct StorageManager)
│           └── settings-page/  # Editor settings (Redux-backed)
├── popup/                      # Extension popup
│   ├── index.html
│   ├── index.tsx               # Minimal entry: just renders InvertIdePopup
│   └── invert-ide-popup/
├── sandbox/                    # In-browser compilation & formatting
│   ├── compiler.ts             # TypeScriptCompiler + SassCompiler
│   ├── formatter.ts            # PrettierFormatter
│   ├── sass-sandbox.ts         # Iframe-side SCSS compilation listener
│   └── sass-sandbox.html       # Sandboxed page with relaxed CSP
└── shared/                     # Shared components and state
    ├── utils.ts                # Re-exports uuid
    ├── components/
    │   ├── CodeEditorThemes.ts # 17 Monaco themes + registration
    │   ├── button/
    │   ├── checkbox/
    │   ├── code-comment/
    │   ├── error-boundary/
    │   ├── icon-button/
    │   ├── input/
    │   ├── resize-handle/
    │   ├── select/
    │   ├── switch/
    │   └── typography/
    └── store/
        ├── store.ts            # configureStore (userscripts + settings slices)
        ├── hooks.ts            # useAppDispatch, useAppSelector, useAppStore
        └── slices/
            ├── userscripts.slice.ts  # Scripts CRUD + compilation thunks
            └── settings.slice.ts     # Editor settings thunks + optimistic reducers
```

### Runtime Package Structure

```
packages/runtime/src/
├── background.ts              # Service worker entry (registers Chrome listeners)
├── content/
│   └── content.ts             # Content script (ping responder)
├── handlers/
│   ├── component-handlers/
│   │   └── tab.handler.ts     # Tab update listener → inject scripts
│   └── extension-handlers/
│       ├── navigation.handler.ts  # Web navigation completed → inject scripts
│       └── runtime.handler.ts     # onInstalled + onMessage handlers
└── ide/
    └── scripts.ts             # URL matching + script injection via chrome.scripting
```

### Shared Package Structure

```
packages/shared/src/
├── index.ts       # Barrel: re-exports model, storage, and compiler (from renderer)
├── model.ts       # All data types (Userscript, GlobalModule, EditorSettings, etc.)
├── messages.ts    # Type-safe messaging (RuntimePortMessageEvent, sources, payloads)
└── storage.ts     # StorageManager (chrome.storage.sync wrapper)
```

### Root-Level Files

```
├── webpack.config.ts          # Build configuration (4 entry points, loaders, plugins)
├── eslint.config.mjs          # Shared ESLint base config
├── prettier.config.mjs        # Prettier formatting config
├── tsconfig.json              # Root TS config for tools + root files
├── tsconfig.base.json         # Shared compiler options for all packages
├── TODO.md                    # Outstanding tasks and known issues
├── public/
│   ├── manifest.json          # Chrome Extension Manifest V3
│   └── assets/                # Static assets
├── tools/                     # Custom dev tooling
│   ├── chrome-extension-reloader-webpack-plugin.ts
│   ├── chrome-extension-reloader-plugin-utils.ts
│   └── chrome-extension-reloader-client.js
└── resources/                 # Project resources
```
