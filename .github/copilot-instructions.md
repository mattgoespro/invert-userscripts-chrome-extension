# Copilot Instructions

## Project Overview

**Invert IDE** is a Chrome extension (Manifest V3) that provides an integrated TypeScript/SCSS IDE directly in the browser. Users can write, manage, and inject JavaScript userscripts with a Monaco editor, combining development tooling with script injection capabilities. The extension compiles TypeScript and SCSS in-browser, formats code with Prettier, and programmatically injects compiled scripts into matching web pages. Scripts can be marked as **shared modules** to enable cross-script dependency graphs via a runtime import resolution system.

---

## Architecture & Monorepo Structure

The project follows a monorepo architecture with four distinct packages:

| Package             | Purpose                                                           | Key Technologies                                                |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/renderer` | React-based UI for the Options page (IDE) and extension Popup     | TypeScript, React 19, React Redux, Redux Toolkit, Monaco Editor |
| `packages/runtime`  | Background service workers and content scripts                    | TypeScript, Chrome Extensions API                               |
| `packages/shared`   | Common types, storage wrappers, and message definitions           | TypeScript                                                      |
| `packages/monaco`   | Monaco editor integration, Shiki tokenizer, and theme definitions | TypeScript, Monaco Editor, Shiki                                |

### Package Dependencies

```text
packages/renderer ──→ packages/shared
packages/renderer ──→ packages/monaco
packages/runtime  ──→ packages/shared
packages/monaco   ──→ packages/shared
```

### `packages/renderer`

The renderer package contains the React-based UI for both the **Options page** (the main IDE) and the extension **Popup**. These are two separate Webpack entry points (`options/index.tsx` and `popup/index.tsx`) that share a common set of UI components, hooks, store slices, and utilities via `packages/renderer/src/shared/`.

Code inside `packages/renderer/src/shared/` is **renderer-internal** — it is UI-related functionality shared between the Options and Popup entry points. It is not consumed by `runtime` or `monaco`. When functionality is only needed by one of the two entry points, it belongs in that entry point's directory (e.g., `options/` or `popup/`), not in `shared/`.

### `packages/runtime`

The runtime package contains the Chrome extension's background service worker and content scripts. It handles extension lifecycle events (`onInstalled`, `onMessage`), web navigation listeners, tab update listeners, and programmatic script injection via `chrome.scripting.executeScript`. It depends on `packages/shared` for data models and storage access.

### `packages/shared`

The shared package provides cross-package functionality — common types, storage wrappers, message definitions, and TypeScript compiler options — that is required by **2 or more** other packages in the monorepo. Code should only be placed here when at least two other packages depend on it (e.g., data models used by both `renderer` and `runtime`, storage wrappers used by both `renderer` and `runtime`). If only a single package needs a piece of functionality, that functionality belongs inside that package — not in `packages/shared/`.

### `packages/monaco`

The monaco package encapsulates all Monaco editor integration: Shiki tokenizer registration, editor theme definitions, TypeScript compiler defaults configuration, and shared script declaration generation. It depends on `packages/shared` for data models and TypeScript compiler options.

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
- `@packages/monaco` → Maps to `packages/monaco/src/index.ts`. Use for importing Monaco editor integration, themes, and utilities.
- `@/*` → Maps to `./src/*` within the renderer package (e.g., `@/shared/components` → `packages/renderer/src/shared/components`).
- `@assets/styles/invert-ide` → Maps to the main SCSS entry file (`packages/renderer/src/assets/styles/_index.scss`).

---

## Data Models

Core data types are defined in `packages/shared/src/model.ts`:

### Userscript

The central data type. Each userscript stores both source and compiled code:

```typescript
type UserscriptStatus = "modified" | "saved";
type UserscriptSourceLanguage = "typescript" | "scss";
type UserscriptCompiledLanguage = "javascript" | "css";

interface Userscript {
  id: string;
  name: string;
  enabled: boolean;
  status: UserscriptStatus;
  error?: boolean;
  shared: boolean;
  moduleName: string;
  sharedScripts: string[];
  code: {
    source: { [key in UserscriptSourceLanguage]: string };
    compiled: { [key in UserscriptCompiledLanguage]: string };
  };
  urlPatterns: string[];
  runAt: "beforePageLoad" | "afterPageLoad";
  createdAt: number;
  updatedAt: number;
}

type Userscripts = Record<string, Userscript>;
```

**Key fields**:

- **`shared`** — When `true`, marks this script as a shared module that other scripts can import.
- **`moduleName`** — The module name used for import resolution (e.g., `import { fn } from "shared/moduleName"`).
- **`sharedScripts`** — Array of userscript IDs this script depends on (shared script dependencies).
- **`runAt`** — `"beforePageLoad"` or `"afterPageLoad"` (not `document_start`/`document_end`).
- **`createdAt` / `updatedAt`** — Numeric timestamps (`Date.now()`), not ISO strings.

### UI State Models

```typescript
type SidebarTab = "scripts" | "modules" | "settings";
type OutputDrawerTab = "javascript" | "css";

interface UIPanelSizes {
  scriptListWidth: number;
  tsScssHorizontalSplit: number;
  sourceVsDrawerSplit: number;
}

interface UIState {
  activeSidebarTab: SidebarTab;
  selectedScriptId: string | null;
  outputDrawerCollapsed: boolean;
  outputDrawerActiveTab: OutputDrawerTab;
  panelSizes: UIPanelSizes;
}
```

### Other Models

- **`GlobalModule`**: External JavaScript modules (`{ id, name, url, enabled }`) that can be injected globally.
- **`GlobalModules`**: `Record<string, GlobalModule>`.
- **`EditorSettings`**: Monaco editor configuration (`{ theme?, fontSize?, tabSize?, autoFormat?, autoSave? }`). `theme` is typed as `EditorThemeName` from `@packages/monaco`.
- **`UserscriptCompileResult`**: Compilation output (`{ success, code?, error?: Error }`).
- **`SharedScriptInfo`**: Shared script metadata (`{ id, name, moduleName, sourceCode }`).

---

## State Management & Persistence

### Storage Strategy

All persistence is handled via `chrome.storage.sync`, abstracted by two manager classes in `packages/shared/src/storage/`.

**`ChromeSyncStorage` API** (all static methods, in `sync.storage.ts`):

| Method                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `getAll()`                     | Returns all stored data                    |
| `getAllScripts()`              | Returns `Userscripts` record               |
| `saveScript(script)`           | Merges script into storage                 |
| `updateScript(id, updates)`    | Partial update                             |
| `deleteScript(scriptId)`       | Removes a script                           |
| `getAllModules()`              | Returns `GlobalModules` record             |
| `saveModule(module)`           | Upserts a module                           |
| `deleteModule(moduleId)`       | Removes a module                           |
| `getEditorSettings()`          | Returns settings (with hardcoded defaults) |
| `saveEditorSettings(settings)` | Merges partial settings                    |

**`GlobalStateManager` API** (all static methods, in `global-state.storage.ts`):

| Method        | Description                                          |
| ------------- | ---------------------------------------------------- |
| `get()`       | Returns `GlobalState`, deep-merged with defaults     |
| `save(state)` | Persists full `GlobalState` to `chrome.storage.sync` |

**Exported defaults**:

- `ChromeSyncStorage.defaultSettings` — `EditorSettings` with theme `"invert-dark"`, appTheme `"graphite"`, fontSize 11, tabSize 2, autoFormat true, autoSave true.
- `GlobalStateManager.defaultState` — `GlobalState` with scripts tab active, null selection, drawer open, 30/50/70 panel splits.

### State Architecture Overview

| State Type                    | Pattern                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **Userscripts** (complex)     | Redux Toolkit slice + `createAsyncThunk` for async storage                   |
| **Editor Settings** (complex) | Redux Toolkit slice + `createAsyncThunk` for async storage                   |
| **Editor State** (complex)    | Redux Toolkit slice for Monaco init, saving, and TS defaults                 |
| **UI Layout State**           | React Context (`GlobalStateProvider`) + `GlobalStateManager` for persistence |
| **Global Modules** (simple)   | Direct `ChromeSyncStorage` access with `useState` and manual `loadData`      |

### Redux Store Configuration

The store is configured in `packages/renderer/src/shared/store/store.ts`:

- **Three slices**: `userscripts`, `settings`, `editor`
- **Middleware**: `redux-logger` (collapsed, diff mode)
- **DevTools**: Named `"Invert IDE Userscripts"`
- **No epics / no Redux Observable** — all async operations use `createAsyncThunk`

### Typed Redux Hooks

Always use the typed hooks from `packages/renderer/src/shared/store/hooks.ts`:

```tsx
import {
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "@/shared/store/hooks";
```

### Redux Flow for Userscripts

The `userscripts.slice.ts` defines:

**Async Thunks** (6): `loadUserscripts`, `createUserscript`, `deleteUserscript`, `toggleUserscript`, `updateUserscript`, `updateUserscriptCode`

**Sync Reducers** (2): `setCurrentUserscript`, `markUserscriptModified` (both use `prepare` callback to wrap bare IDs)

**Selectors** (5): `selectAllUserscripts`, `selectCurrentUserscript`, `selectUserscriptById`, `selectUnsavedUserscripts`, `selectSharedUserscripts`

**Storage Quota Pattern**: All write thunks strip `compiled` code before persisting to `chrome.storage.sync` to stay within the 8KB-per-key quota. Full compiled code is kept in Redux state only.

Flow:

1. Component dispatches an async thunk (e.g., `updateUserscriptCode`)
2. Thunk performs async work (compilation, storage persistence via `ChromeSyncStorage`)
3. `extraReducers` handles `pending`/`fulfilled`/`rejected` states
4. Selectors provide derived access to state

### Redux Flow for Settings

The `settings.slice.ts` defines:

**Async Thunks** (2): `loadSettings`, `updateSettings`

**Sync Reducers** (5): `setTheme`, `setFontSize`, `setTabSize`, `setAutoFormat`, `setAutoSave`

**Selectors** (2): `selectEditorSettings`, `selectIsLoading`

**Pattern**: Each setting has a sync reducer (optimistic UI update) while `updateSettings` handles persistent storage. `loadSettings` merges stored values with `defaultSettings`.

### Redux Flow for Editor

The `editor.slice.ts` defines:

**Async Thunks** (2): `initializeMonaco`, `saveEditorCode`

**Plain Thunks** (3): `configureTypescriptDefaults`, `syncSharedScriptLibs`, `disposeSharedScriptLibs` (manual dispatch functions, not `createAsyncThunk`)

**Sync Reducers** (1): `setTsDefaultsConfigured`

**Selectors** (4): `selectMonacoReady`, `selectTsDefaultsConfigured`, `selectIsSaving`, `selectSharedScriptsForUserscript` (parameterized cross-slice selector)

**Key behaviors**:

- `initializeMonaco` calls `registerMonaco()` from the monaco package. If Shiki initialization fails, `monacoReady` is still set to `true` so Monarch tokenizers serve as fallback.
- `saveEditorCode` optionally formats with Prettier, then dispatches `updateUserscriptCode` from the userscripts slice.
- Shared script TypeScript declarations are managed via module-scoped `Map<string, IDisposable>` outside Redux state (non-serializable).

### UI State Context

The `GlobalStateProvider` and `useGlobalState()` hook in `packages/renderer/src/options/invert-ide/contexts/global-state.context.tsx` manage persistent UI layout state outside Redux:

```tsx
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";

const { uiState, updateUIState, updatePanelSizes } = useGlobalState();
```

- React Context + Provider pattern (not Redux)
- Debounced persistence (500ms) to `chrome.storage.sync` via `GlobalStateManager`
- Returns `null` (no children rendered) until initial state is loaded, preventing layout flicker
- Two update methods: `updateUIState` (shallow merge at top level) and `updatePanelSizes` (shallow merge into `panelSizes`)

---

## Component & Styling Guidelines

### UI Components

Use the custom component library in `packages/renderer/src/shared/components`:

| Component       | Purpose                                         | Import Path                                        |
| --------------- | ----------------------------------------------- | -------------------------------------------------- |
| `Button`        | Standard buttons                                | `@/shared/components/button/Button`                |
| `IconButton`    | Icon-only buttons (Lucide icons)                | `@/shared/components/icon-button/IconButton`       |
| `Input`         | Text inputs                                     | `@/shared/components/input/Input`                  |
| `Select`        | Custom dropdown select (not native `<select>`)  | `@/shared/components/select/Select`                |
| `Checkbox`      | Checkboxes                                      | `@/shared/components/checkbox/Checkbox`            |
| `Switch`        | Toggle switches                                 | `@/shared/components/switch/Switch`                |
| `Typography`    | Text elements with variant styling              | `@/shared/components/typography/Typography`        |
| `CodeComment`   | Code-styled `//` comment display                | `@/shared/components/code-comment/CodeComment`     |
| `CodeLine`      | Inline TypeScript syntax highlighter            | `@/shared/components/code-line/CodeLine`           |
| `ResizeHandle`  | Panel resize separator (react-resizable-panels) | `@/shared/components/resize-handle/ResizeHandle`   |
| `ErrorBoundary` | Error boundary fallback UI                      | `@/shared/components/error-boundary/ErrorBoundary` |
| `DevTools`      | Development toolbar (theme switcher, storage)   | `@/shared/components/devtools/DevTools`            |

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
import { CodeLine } from "@/shared/components/code-line/CodeLine";
```

### Component Details

**`Select`** is a fully custom dropdown — not a native `<select>` element. It is generic (`Select<T>`), supports keyboard navigation (arrow keys, Escape), click-outside-to-close, and custom chevron animation.

**`CodeLine`** renders inline TypeScript syntax highlighting with a regex-based tokenizer. Token types: `keyword`, `type`, `function-name`, `string`, `punctuation`, `identifier`, `comment`, `whitespace`. Each token renders as a `<span>` with a BEM-style class (`code-line--keyword`, etc.).

**`ResizeHandle`** wraps `Separator` from `react-resizable-panels`.

**`ErrorBoundary`** uses `react-error-boundary` with `FallbackProps` pattern. Renders error name, message, and filtered stack trace.

**`DevTools`** provides a development toolbar with two items: a theme switcher (for UI SCSS themes) and a chrome.storage.sync inspector.

### Additional Shared Exports

- `utils.ts` — Re-exports `uuid` from the `uuid` package: `export { v4 as uuid } from "uuid"`.

---

## Component Implementation Patterns

### File Structure

Every component MUST follow this structure:

```text
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

export function ComponentName({
  variant = "primary",
  ...rest
}: ComponentNameProps) {
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

The styling system uses a **3-tier design token pipeline** with a **multi-theme override layer**, defined in `packages/renderer/src/assets/styles/`. All tokens are CSS custom properties on `:root`, imported once at the app root via `_index.scss`.

```text
_primitives.scss  →  _themes.scss  →  _semantic.scss  →  _components.scss
   (raw values)     (theme overrides)  (intent aliases)   (component contracts)
                                     ↘                  ↗
                                       _typography.scss
                                       _mixins.scss
```

Import order in `_index.scss`: `primitives → themes → semantic → components → typography → mixins`

> **Important**: `_index.scss` is imported once in `options/index.tsx`. **Do NOT import any style token file directly into React components** — the CSS variables are globally available via `var()` syntax.

### Tier 1: Primitives (`_primitives.scss`)

Raw design values. All prefixed with `--base-*`. **Never reference these directly in components.**

| Category             | Examples                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Core palette         | `--base-black`, `--base-white`, `--base-grey`, `--base-blue`, `--base-gold`, `--base-red`, `--base-green`     |
| Surfaces             | `--base-surface-base`, `--base-surface-raised`, `--base-surface-overlay`, `--base-surface-input`              |
| Borders              | `--base-border`, `--base-border-subtle`, `--base-border-focus`                                                |
| Text                 | `--base-text`, `--base-text-muted`, `--base-text-muted-faint`, `--base-text-muted-strong`                     |
| Accent               | `--base-accent`, `--base-accent-hover`, `--base-accent-muted`, `--base-accent-subtle`, `--base-accent-border` |
| Interactive overlays | `--base-hover-overlay`, `--base-active-overlay` (micro white wash)                                            |
| Danger               | `--base-danger`, `--base-danger-soft`                                                                         |
| Error states         | `--base-error-accent`, `--base-error-surface`, `--base-error-text`, etc.                                      |
| Syntax highlighting  | `--base-syntax-keyword`, `--base-syntax-function`, etc.                                                       |
| Component-specific   | Button, switch, select, icon button, input primitives                                                         |

Also defines SCSS variables (`$black`, `$white`, `$blue`, `$gold`, etc.) used for `color.scale()` transformations within the same file.

### Theme Layer (`_themes.scss`)

Multi-theme system via `[data-theme]` attribute selectors. The default theme (Graphite) comes from `_primitives.scss`. Theme files override `--base-*` primitives.

| Theme File             | `data-theme` Value |
| ---------------------- | ------------------ |
| `_graphite-warm.scss`  | `graphite-warm`    |
| `_graphite-dusk.scss`  | `graphite-dusk`    |
| `_graphite-ember.scss` | `graphite-ember`   |
| `_obsidian.scss`       | `obsidian`         |
| `_obsidian-deep.scss`  | `obsidian-deep`    |
| `_obsidian-ember.scss` | `obsidian-ember`   |
| `_obsidian-frost.scss` | `obsidian-frost`   |

Themes are switched at runtime by setting the `data-theme` attribute on a root element, managed by the `DevTools` → `ThemeSwitcher` component.

### Tier 2: Semantic Tokens (`_semantic.scss`)

Intent-driven aliases referencing `--base-*` primitives. **These are the primary tokens for component styling.**

| Category    | Variables                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core        | `--primary`, `--primary-hover`, `--accent`, `--accent-hover`, `--accent-muted`, `--accent-subtle`, `--accent-border`, `--danger`, `--success`                  |
| Layout      | `--background`, `--foreground`, `--border`, `--border-subtle`, `--border-focus`                                                                                |
| Surfaces    | `--surface-base`, `--surface-raised`, `--surface-overlay`, `--surface-input`                                                                                   |
| Text        | `--text-muted`, `--text-muted-faint`, `--text-muted-strong`                                                                                                    |
| Interactive | `--hover-overlay`, `--active-overlay`                                                                                                                          |
| Danger      | `--danger-soft`, `--danger-strong`                                                                                                                             |
| Error       | `--error-accent`, `--error-accent-soft`, `--error-glow`, `--error-surface`, `--error-surface-dark`, `--error-text`, `--error-text-muted`, `--error-border`     |
| Syntax      | `--syntax-keyword`, `--syntax-member`, `--syntax-function`, `--syntax-param`, `--syntax-type`, `--syntax-punctuation`, `--syntax-comment`                      |
| Status      | `--info`, `--warning`, `--error`                                                                                                                               |
| Geometry    | `--geometry-border-radius: 4px`                                                                                                                                |
| Spacing     | `--spacing-2xs` (2px), `--spacing-xs` (4px), `--spacing-sm` (8px), `--spacing-md` (12px), `--spacing-lg` (16px), `--spacing-xl` (20px), `--spacing-2xl` (24px) |

### Tier 3: Component Tokens (`_components.scss`)

Themeable tokens that form the styling contract for each UI component:

- **Input**: `--input-foreground`, `--input-background`, `--input-border`, `--input-placeholder`
- **Label**: `--label-foreground`
- **Button**: `--button-foreground`, `--button-background`, `--button-hover-background`, `--button-active-background`, `--button-disabled-foreground`, `--button-disabled-background`
- **Icon Button**: `--icon-button-foreground`, `--icon-button-background`, `--icon-button-border`, `--icon-button-hover-background`, `--icon-button-focus-background`
- **Switch**: `--switch-foreground`, `--switch-background`, `--switch-checked-foreground`, `--switch-checked-background`, `--switch-border`
- **Select**: `--select-foreground`, `--select-background`, `--select-border`, `--select-placeholder`
- **Checkbox**: `--checkbox-foreground`, `--checkbox-background`, `--checkbox-border`, `--checkbox-checked-background`, `--checkbox-checked-foreground`
- **Typography**: `--title-foreground`, `--subtitle-foreground`
- **Layout Spacing**: `--input-height`, `--button-padding-y`, `--button-padding-x`, `--page-padding`, `--section-padding`, `--section-gap`, `--field-gap`

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
| `label`    | JetBrains Mono | 12px     | 400    |
| `code`     | JetBrains Mono | 0.875rem | 400    |

The `code` variant also has `--typography-code-letter-spacing: -0.01em`.

Access via: `var(--typography-{variant}-font-size)`, `var(--typography-{variant}-font-weight)`, etc.

### Global Mixins (`_mixins.scss`)

| Mixin         | Purpose                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `focus-ring`  | Applies `:focus-visible` with `outline: none` and `border-color: var(--accent-border)` |
| `label-style` | Applies full typography-label token set + `text-transform: uppercase`                  |

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
- `.code-line`, `.code-line--keyword`, `.code-line--function-name`
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

// ✅ CORRECT - Interactive state using overlay tokens
.my-interactive {
  &:hover {
    background-color: var(--hover-overlay);
  }
  &:active {
    background-color: var(--active-overlay);
  }
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
    @include label-style;
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
```

### Important SCSS Rules

1. **Never import token SCSS files** directly in components — CSS variables are globally available
2. **Use `rem` units** for sizing (not `px`) when possible
3. **Keep transitions short** — 0.2s to 0.3s for interactive elements
4. **Scope all styles** under a component-specific class to avoid conflicts
5. **Use the spacing scale** (`--spacing-xs`, `--spacing-sm`, `--spacing-md`, etc.) for consistent spacing

---

## Design Aesthetic Guidelines

### Typography

The design system uses **Outfit** for headings, **Open Sans** for body text, and **JetBrains Mono** for code, inputs, buttons, and labels. Ensure:

- Proper hierarchy with `Typography` variants (`title`, `subtitle`, `body`, `caption`)
- Uppercase labels with `text-transform: uppercase` for form labels (use `@include label-style` mixin)
- JetBrains Mono for all interactive/code-related text
- Appropriate font weights from the typography scale

### Color & Theme

The design is **flat, matte, and VS Code Dark Modern-inspired** — zero glass, zero blur, zero glow:

- Dark backgrounds (`--surface-base`, `--surface-raised`, `--surface-overlay`)
- Light foregrounds (`--foreground`)
- **Blue accent** (`--accent`) for primary actions and highlights
- **Blue primary** (`--primary`) for interactive elements
- **Interactive overlays** (`--hover-overlay`, `--active-overlay`) for hover/active states

Use the established color tokens; do not introduce new colors without updating the design token system.

### Multi-Theme System

The application supports **8 UI themes** (1 default + 7 overrides) via `[data-theme]` attribute:

- **Graphite** (default), **Graphite Warm**, **Graphite Dusk**, **Graphite Ember**
- **Obsidian**, **Obsidian Deep**, **Obsidian Ember**, **Obsidian Frost**

Themes override `--base-*` primitives; semantic and component tokens cascade automatically. The `DevTools` → `ThemeSwitcher` manages theme switching at runtime.

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
```

---

## Sandbox Architecture (Compilation & Formatting)

The `packages/renderer/src/sandbox/` directory contains the in-browser compilation and formatting system.

### TypeScript Compilation

`TypeScriptCompiler` (static class in `compiler.ts`) wraps `typescript.transpileModule()` directly:

- Uses shared `TypeScriptCompilerOptions` from `packages/shared/src/typescript.ts`
- Options: Target ES2020, Module ESNext, ModuleResolution Node10, esModuleInterop, allowJs, checkJs, isolatedModules
- Strict mode disabled (to match shared config)
- Returns `UserscriptCompileResult` (`{ success, code?, error?: Error }`)

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

| Handler                 | Listens To                         | Action                                                           |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `runtime.handler.ts`    | `chrome.runtime.onInstalled`       | Logs installation                                                |
| `runtime.handler.ts`    | `chrome.runtime.onMessage`         | Handles `"refreshTabs"` → injects scripts                        |
| `navigation.handler.ts` | `chrome.webNavigation.onCompleted` | Main-frame only → injects matching scripts                       |
| `tab.handler.ts`        | `chrome.tabs.onUpdated`            | Tab loading → injects matching scripts (self-registers listener) |

### Script Injection

The core injection logic lives in `packages/runtime/src/ide/scripts.ts`:

1. **`injectMatchingScripts(tabId, url)`** — Fetches enabled scripts from storage, filters by URL pattern match, injects shared dependencies first, then injects each script
2. **`matchesUrlPattern(url, patterns)`** — Converts glob patterns (`*`, `?`) to regex and tests against URL
3. **`injectScript(tabId, script)`** — Uses `chrome.scripting.executeScript` with `world: "MAIN"` to inject compiled JavaScript via a dynamically created `<script>` element. If the script has shared dependencies, resolves `import ... from "shared/..."` statements first via `resolveSharedImports`
4. **`injectSharedScript(tabId, script)`** — Wraps shared script code via `wrapSharedScriptForInjection` and injects it into the page

### Shared Script Injection System

Shared scripts use a runtime module registry on `window.__INVERT_SHARED__`:

- **`wrapSharedScriptForInjection(moduleName, compiledJs)`** — Strips `export` keywords from compiled JS, wraps code in an IIFE, and registers all exported members on `window.__INVERT_SHARED__[moduleName]`
- **`resolveSharedImports(compiledJs)`** — Transforms `import { x } from "shared/name"` statements into `const { x } = window.__INVERT_SHARED__["name"]` lookups
- Injection order: shared dependencies are injected before consumer scripts, with deduplication via a `Set<string>`

Background script (`packages/runtime/src/background.ts`) registers Chrome event listeners for `onInstalled`, `onMessage`, and `webNavigation.onCompleted`. The `tab.handler.ts` self-registers its `chrome.tabs.onUpdated` listener via side-effect import.

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

| Scope                         | Loader                                                 | Config              |
| ----------------------------- | ------------------------------------------------------ | ------------------- |
| `packages/shared/src/*.ts`    | `esbuild-loader`                                       | Shared tsconfig     |
| `packages/monaco/src/*.ts`    | `esbuild-loader`                                       | Monaco tsconfig     |
| `packages/runtime/**/*.ts`    | `esbuild-loader`                                       | Runtime tsconfig    |
| `packages/renderer/**/*.tsx?` | `esbuild-loader` (`loader: "tsx"`, `jsx: "automatic"`) | Renderer tsconfig   |
| `.scss`                       | `style-loader → css-loader → sass-loader`              |                     |
| `.css`                        | `style-loader → css-loader`                            |                     |
| `.ttf`                        | `asset/resource`                                       | Monaco editor fonts |

**`noParse`**: `typescript.js` and `sass.dart.js` are excluded from parsing to improve build performance.

### Resolve Aliases

- `@` → `packages/renderer/src/`
- `@shared` → `packages/shared/src/`
- `@packages/monaco` → `packages/monaco/src/`
- `@assets/styles/invert-ide` → main SCSS index
- `monaco-editor-core` → `monaco-editor/esm/vs/editor/editor.api.js`
- `monaco-editor` → ESM editor API entry

### Plugins

- `HtmlWebpackPlugin` ×3 (popup, options, sass-sandbox)
- `MonacoEditorWebpackPlugin`
- `CopyWebpackPlugin` (manifest.json + images)
- `FaviconsWebpackPlugin`
- `ChromeExtensionReloaderWebpackPlugin` (development only — see Development Tooling)

### Chunk Splitting

Monaco editor and Sass are isolated into separate chunks to optimize loading.

### Build Optimization

- **Minimizer**: `TerserPlugin` (production only, `extractComments: false`)
- **Split Chunks**: Monaco editor and Sass isolated into named cache groups with content-hashed filenames
- **Cache**: Filesystem caching enabled for faster rebuilds
- **Output**: `pathinfo: false` to reduce garbage collector pressure; chunk files output to `chunks/[chunkhash].js`
- **Stats**: `"errors-warnings"` for reduced console noise

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

A custom WebSocket-based hot-reload system in `plugins/`:

| File                                                 | Purpose                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `plugins/index.ts`                                   | Barrel: re-exports `ChromeExtensionReloaderWebpackPlugin`                                   |
| `plugins/extension-reloader-plugin/index.ts`         | Webpack plugin: starts WS server, injects client, broadcasts messages on build              |
| `plugins/extension-reloader-plugin/model.ts`         | Plugin options interface (`ChromeExtensionReloaderPluginOptions`) + `BroadcastMessage` type |
| `plugins/extension-reloader-plugin/client/client.js` | Client IIFE: listens for `"reload"`, saves/restores page state, refreshes                   |
| `plugins/extension-reloader-plugin/client/load.ts`   | Client script loader with template variable substitution                                    |
| `plugins/extension-reloader-plugin/utils/logger.ts`  | Colored console logger with verbose mode                                                    |
| `plugins/extension-reloader-plugin/utils/browser.ts` | Chrome path resolver for auto-launch                                                        |

**Plugin Options** (`ChromeExtensionReloaderPluginOptions`):

| Option              | Default | Description                                                                       |
| ------------------- | ------- | --------------------------------------------------------------------------------- |
| `port`              | `8081`  | WebSocket server port                                                             |
| `verbose`           | `false` | Enable verbose logging                                                            |
| `autoLaunchBrowser` | `false` | Auto-launch Chrome with extension loaded on startup                               |
| `consoleOptions`    | —       | Config for capturing/forwarding console output (`captureLevels`, `ignoreMessage`) |
| `excludeAssets`     | `[]`    | HTML asset names to exclude from client script injection                          |

**Broadcast Message Types**: `"configure"` (initial setup), `"reload"` (trigger refresh), `"log"` (forwarded console output).

**How it works** (development mode only):

1. Plugin starts a WebSocket server (default port `8081`)
2. On client connection, sends `"configure"` message with console capture options
3. On compilation, injects the client script into all HTML assets (excluding `excludeAssets`)
4. On build completion, broadcasts `"reload"` to all connected clients
5. Client saves scroll position + input values to `sessionStorage`, refreshes CSS links, then `location.reload()`
6. On page load, client restores saved state
7. Auto-reconnects on WebSocket close with 1s delay

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

---

## TypeScript Configuration

### Composite Project Structure

The project uses TypeScript project references:

```text
tsconfig.json (root — includes plugins/, *.ts at root)
├── tsconfig.base.json (shared compiler options)
├── packages/shared/tsconfig.json (composite, references monaco)
├── packages/monaco/tsconfig.json (composite, references shared)
├── packages/runtime/tsconfig.json (composite, references shared)
└── packages/renderer/tsconfig.json (composite, references shared + monaco)
```

### Key TypeScript Compiler Options

**Base Options** (`tsconfig.base.json`):

- **Target**: ES2020
- **Module**: ESNext with Bundler module resolution
- **Strict Mode**: Disabled at base level
- **noImplicitAny**: true
- **forceConsistentCasingInFileNames**: true
- **noImplicitThis**: true
- **esModuleInterop**: true
- **resolveJsonModule**: true
- **skipLibCheck**: true
- **Base Paths**: `@shared/*` → `packages/shared/src/*`, `@monaco/*` → `packages/monaco/src/*`

**Renderer Package Additions**:

- **JSX**: `react-jsx`
- **Lib**: `es2020`, `dom`, `dom.iterable`, `es2023.array`
- **Types**: `chrome`, `react`, `react-dom`
- **Path Aliases**: `@/*` → `./src/*`, `@shared/*` → `../shared/src/*`, `@packages/monaco` → `../monaco/src/index.ts`, `monaco-editor-core` → `../../node_modules/monaco-editor`
- **References**: `shared`, `monaco`

**Runtime Package Additions**:

- **Lib**: `es2020`, `dom`, `dom.iterable`
- **Types**: `node`, `chrome`
- **Path Aliases**: `@/*` → `./src/*`, `@shared/*` → `../shared/src/*`
- **References**: `shared`

**Monaco Package**:

- **Lib**: `es2020`, `dom`, `dom.iterable`
- **Path Aliases**: `@shared/*` → `../../packages/shared/src/*`, `monaco-editor-core` → `../../node_modules/monaco-editor`
- **References**: `shared`

**Shared Package**:

- **Lib**: `dom`, `dom.iterable`
- **Path Aliases**: `@packages/monaco` → `../monaco/src/index.ts`
- **References**: `monaco`

## TypeScript Best Practices

When writing, refactoring, or updating TypeScript code:

1. **Use explicit types** for function parameters and return values
2. **Avoid `any`** — prefer specific types or `unknown` with type guards
3. **Use `interface` for object shapes** and `type` for unions/intersections
4. **Use `as const` for literal types** when appropriate (e.g., action type constants)
5. **Leverage TypeScript's type inference** where possible, but be explicit in public APIs
6. **Use scoped control flow blocks** (e.g., `if`, `for`, `try/catch`) with proper block scoping and avoid single-line statements without braces
7. **Use `error` as the variable name in `catch` blocks** for consistency
8. **Use `event` as the variable name for event handlers** for clarity

When commenting TypeScript code, prefer JSDoc style for functions and complex logic:

```typescript
/**
 * Compiles TypeScript code to JavaScript.
 * @param code - The TypeScript source code to compile
 * @returns The result of compilation, including success status and compiled code or error message
 */
static compile(code: string): UserscriptCompileResult {
  return this.transpileModule(code, {
    compilerOptions: TypeScriptCompilerOptions,
  });
}
```

- When prompted to write JSDoc comments for types and properties, always use multiline JSDoc comments in the format:

```typescript
/**
 * Represents test data for demonstration purposes.
 */
export interface Test {
  /**
   * Test ID
   */
  id: string;
}
```

- Inline comments requiring multiple lines should be block comments.
- Use inline comments sparingly and only when they add value to the code's readability for complex logic or non-obvious decisions.

### Type-Only Re-exports in Barrel Files

The build uses `esbuild-loader` for TypeScript transpilation, which performs **isolated file transpilation** without cross-file type awareness. This means `esbuild` erases interfaces and type aliases at compile time — they don't exist as runtime values. When a barrel `index.ts` re-exports a type using a value-style export, webpack cannot resolve it and emits a warning.

**Always use `export type` for re-exporting interfaces and type aliases from barrel files:**

```typescript
// ✅ CORRECT — separate value and type re-exports
export { GlobalStateManager } from "./global-state.storage";
export type { GlobalState, GlobalStateSizes } from "./global-state.storage";

// ❌ WRONG — mixed value and type re-exports in a single statement
export {
  GlobalStateManager,
  GlobalState,
  GlobalStateSizes,
} from "./global-state.storage";
```

This applies to all `index.ts` barrel files across every package.

### Additional Rules

For additional code quality, refer to the ESLint rules defined in `eslint.config.mjs`, especially those related to TypeScript and React.
For formatting consistency, refer to the Prettier configuration in `prettier.config.mjs`.

---

## File Organization

### Renderer Package Structure

```text
packages/renderer/src/
├── assets/                           # Images and global styles
│   ├── images/
│   └── styles/
│       ├── _index.scss               # Token orchestrator (imported at app root)
│       ├── _primitives.scss          # Tier 1: Raw design values (--base-*)
│       ├── _semantic.scss            # Tier 2: Intent aliases (--primary, etc.)
│       ├── _components.scss          # Tier 3: Component tokens (--input-*, etc.)
│       ├── _typography.scss          # Typography variants and font families
│       ├── _themes.scss              # Theme import orchestrator
│       ├── _mixins.scss              # Shared mixins (focus-ring, label-style)
│       └── themes/                   # Per-theme override files
│           ├── _graphite-warm.scss
│           ├── _graphite-dusk.scss
│           ├── _graphite-ember.scss
│           ├── _obsidian.scss
│           ├── _obsidian-deep.scss
│           ├── _obsidian-ember.scss
│           └── _obsidian-frost.scss
├── options/                          # Options page (main IDE)
│   ├── index.html
│   ├── index.tsx                     # Entry: ErrorBoundary → Provider → InvertIde
│   └── invert-ide/
│       ├── InvertIde.tsx             # Root IDE component
│       ├── InvertIde.scss
│       ├── components/
│       │   ├── code-editor/          # Monaco editor wrapper (CodeEditor.tsx)
│       │   ├── dashboard-header/     # Decorative banner with syntax-highlighted snippet
│       │   └── sidebar/              # Navigation sidebar + SidebarNavButton
│       └── pages/
│           ├── scripts-page/         # Script management + dual-pane editor
│           │   ├── ScriptsPage.tsx
│           │   ├── script-list/      # ScriptList + ScriptListItem
│           │   └── script-editor/    # ScriptEditor + CompiledOutputDrawer + ScriptMetadata
│           │       ├── compiled-output-drawer/  # JS/CSS output viewer
│           │       └── script-metadata/         # Script config panel
│           │           ├── file-size-indicator/  # Storage quota display
│           │           ├── script-options-panel/ # Script settings (runAt, shared, etc.)
│           │           └── shared-scripts-selector/ # Shared dependency picker
│           ├── modules-page/         # Global module management (direct ChromeSyncStorage)
│           └── settings-page/        # Editor settings (Redux-backed)
│               └── theme-preview/    # Editor theme preview component
├── popup/                            # Extension popup
│   ├── index.html
│   ├── index.tsx                     # Minimal entry: just renders InvertIdePopup
│   └── invert-ide-popup/
├── sandbox/                          # In-browser compilation & formatting
│   ├── compiler.ts                   # TypeScriptCompiler + SassCompiler
│   ├── formatter.ts                  # PrettierFormatter
│   ├── sass-sandbox.ts              # Iframe-side SCSS compilation listener
│   └── sass-sandbox.html            # Sandboxed page with relaxed CSP
└── shared/                           # Shared components and state
    ├── utils.ts                      # Re-exports uuid
    ├── components/
    │   ├── button/
    │   ├── checkbox/
    │   ├── code-comment/
    │   ├── code-line/                # Inline TypeScript syntax highlighter
    │   ├── devtools/                 # Development toolbar (theme switcher, storage)
    │   │   ├── devtools-item/
    │   │   ├── storage-preview/
    │   │   └── theme-switcher/
    │   ├── error-boundary/
    │   ├── icon-button/
    │   ├── input/
    │   ├── resize-handle/
    │   ├── select/
    │   ├── switch/
    │   └── typography/
    └── store/
        ├── store.ts                  # configureStore (userscripts + settings + editor slices)
        ├── hooks.ts                  # useAppDispatch, useAppSelector, useAppStore
        └── slices/
            ├── userscripts.slice.ts  # Scripts CRUD + compilation thunks
            ├── settings.slice.ts     # Editor settings thunks + optimistic reducers
            └── editor.slice.ts       # Monaco init, saving, TS defaults, shared libs
```

### Runtime Package Structure

```text
packages/runtime/src/
├── background.ts # Service worker entry (registers Chrome listeners)
├── content/
│ └── content.ts # Content script (ping responder)
├── handlers/
│ ├── component-handlers/
│ │ └── tab.handler.ts # Tab update listener → inject scripts
│ └── extension-handlers/
│ ├── navigation.handler.ts # Web navigation completed → inject scripts
│ └── runtime.handler.ts # onInstalled + onMessage handlers
└── ide/
└── scripts.ts # URL matching + script injection via chrome.scripting
```

### Monaco Package Structure

```text
packages/monaco/src/
├── index.ts                # Barrel: re-exports from monaco.ts, theming.ts, typescript-lsp.ts
├── monaco.ts               # registerMonaco() — cached Shiki initialization entry point
├── theming.ts              # EditorThemes map, applyHighlighter(), getThemeOptions()
├── typescript-lsp.ts       # ensureTypescriptDefaults(), shared script declaration generation
├── utils.ts                # CamelToKebabCase utility type
└── themes/
    ├── index.ts             # Barrel for all theme modules
    ├── defaults.ts          # Re-exports of all Shiki built-in themes
    ├── invert-dark.ts       # Custom Invert Dark theme
    ├── graphite-dusk.ts     # Custom Graphite Dusk theme
    ├── bearded-anthracite.ts # Custom Bearded Anthracite theme
    ├── bearded-vivid-black.ts # Custom Bearded Vivid Black theme
    └── monokai-pro.ts       # Custom Monokai Pro theme
```

### Shared Package Structure

```text
packages/shared/src/
├── index.ts             # Barrel: re-exports model and storage
├── model.ts             # All data types (Userscript, GlobalModule, EditorSettings, etc.)
├── messages.ts          # Type-safe messaging (RuntimePortMessageEvent, sources, payloads)
├── storage/
│   ├── index.ts             # Barrel: re-exports ChromeSyncStorage, GlobalStateManager, types
│   ├── sync.storage.ts      # ChromeSyncStorage (chrome.storage.sync wrapper for scripts, modules, settings)
│   └── global-state.storage.ts  # GlobalStateManager + GlobalState/GlobalStateSizes types
└── typescript.ts        # Shared TypeScriptCompilerOptions constant
```

### Root-Level Files

```text
├── webpack.config.ts          # Build configuration (4 entry points, loaders, plugins)
├── eslint.config.mjs          # Shared ESLint base config
├── prettier.config.mjs        # Prettier formatting config
├── tsconfig.json              # Root TS config for plugins/ + root files
├── tsconfig.base.json         # Shared compiler options for all packages
├── TODO.md                    # Outstanding tasks and known issues
├── public/
│   ├── manifest.json          # Chrome Extension Manifest V3
│   └── assets/                # Static assets
├── plugins/                   # Custom dev tooling
│   ├── index.ts               # Barrel: re-exports ChromeExtensionReloaderWebpackPlugin
│   └── extension-reloader-plugin/
│       ├── index.ts           # Webpack plugin implementation
│       ├── model.ts           # Plugin options + message type definitions
│       ├── client/
│       │   ├── client.js      # Client IIFE: reload, save/restore state
│       │   └── load.ts        # Client script loader with template substitution
│       └── utils/
│           ├── logger.ts      # Colored console logger with verbose mode
│           └── browser.ts     # Chrome path resolver for auto-launch
└── resources/                 # Project resources
```
