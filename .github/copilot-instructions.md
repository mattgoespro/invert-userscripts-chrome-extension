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

| Command                        | Description                                         |
| ------------------------------ | --------------------------------------------------- |
| `npm run dev`                  | Run Webpack in watch mode for development           |
| `npm run build`                | Production build                                    |
| `npm run lint`                 | Run ESLint across all packages, tools, and examples |
| `npm run format`               | Run Prettier to format all files                    |
| `npm run clean`                | Remove the `dist` directory                         |
| `npm run icons`                | Generate extension icons via `scripts/`             |
| `npm run start-redux-devtools` | Launch Redux DevTools on localhost:8001             |

### Path Aliases

- `@shared/*` → Maps to `packages/shared/src/*`. Use for importing shared logic across packages.
- `@packages/monaco` → Maps to `packages/monaco/src/index.ts`. Use for importing Monaco editor integration, themes, and utilities.
- `@/*` → Maps to `./src/*` within the renderer package (e.g., `@/shared/components` → `packages/renderer/src/shared/components`).

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

| Component       | Purpose                                           | Import Path                                        |
| --------------- | ------------------------------------------------- | -------------------------------------------------- |
| `Button`        | Standard buttons (CVA variants)                   | `@/shared/components/button/Button`                |
| `IconButton`    | Icon-only buttons (Lucide icons, CVA variants)    | `@/shared/components/icon-button/IconButton`       |
| `Input`         | Text inputs                                       | `@/shared/components/input/Input`                  |
| `Select`        | Custom dropdown select (not native `<select>`)    | `@/shared/components/select/Select`                |
| `Checkbox`      | Checkboxes                                        | `@/shared/components/checkbox/Checkbox`            |
| `Switch`        | Toggle switches                                   | `@/shared/components/switch/Switch`                |
| `Typography`    | Text elements with CVA variant styling            | `@/shared/components/typography/Typography`        |
| `CodeComment`   | Code-styled `//` comment display                  | `@/shared/components/code-comment/CodeComment`     |
| `CodeLine`      | Inline TypeScript syntax highlighter              | `@/shared/components/code-line/CodeLine`           |
| `ResizeHandle`  | Panel resize separator (react-resizable-panels)   | `@/shared/components/resize-handle/ResizeHandle`   |
| `Panel`         | Dropdown overlay panel                            | `@/shared/components/panel/Panel`                  |
| `TabList`       | Tabbed navigation (Tab, TabContent, TabListTitle) | `@/shared/components/tab-list/TabList`             |
| `Toast`         | Toast notifications (with ToastProvider context)  | `@/shared/components/toast/Toast`                  |
| `EditorPanel`   | Editor panel wrapper with inset styling           | `@/shared/components/editor-panel/EditorPanel`     |
| `ErrorBoundary` | Error boundary fallback UI                        | `@/shared/components/error-boundary/ErrorBoundary` |
| `DevTools`      | Development toolbar (theme switcher, storage)     | `@/shared/components/devtools/DevTools`            |

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

**`Select`** is a fully custom dropdown — not a native `<select>` element. It is generic (`Select<T>`), supports keyboard navigation (arrow keys, Escape), click-outside-to-close, and custom chevron animation. Uses CVA for toggle and option variants.

**`CodeLine`** renders inline TypeScript syntax highlighting with a regex-based tokenizer. Token types: `keyword`, `type`, `function-name`, `string`, `punctuation`, `identifier`, `comment`, `whitespace`. Each token renders as a `<span>` with a BEM-style class (`code-line--keyword`, etc.).

**`Panel`** is a dropdown overlay panel positioned absolutely below its container with `animate-panel-enter`. Uses Tailwind utilities for styling with `z-100` layering and custom shadow.

**`TabList`** provides tabbed navigation using `Tab`, `TabContent`, and `TabListTitle` subcomponents. `TabList` renders the tab bar and automatically displays the content of the active `Tab`. Supports `barClassName` for tab bar styling.

**`Toast`** and **`ToastProvider`** implement a toast notification system. `ToastProvider` wraps the app and exposes `toast()` and `dismiss()` via React Context. Supports `info`, `warning`, and `error` variants with CVA, auto-dismiss with configurable duration, and max 5 concurrent toasts.

**`EditorPanel`** wraps editor content with a rounded, bordered container using inset shadow styling.

**`ResizeHandle`** wraps `Separator` from `react-resizable-panels`.

**`ErrorBoundary`** uses `react-error-boundary` with `FallbackProps` pattern. Renders error name, message, and filtered stack trace.

**`DevTools`** provides a development toolbar with two items: a theme switcher (for UI CSS themes) and a chrome.storage.sync inspector.

### Additional Shared Exports

- `utils.ts` — Re-exports `uuid` from the `uuid` package: `export { v4 as uuid } from "uuid"`.

---

## Component Implementation Patterns

### File Structure

Every component MUST follow this structure:

```text
component-name/
  ComponentName.tsx
```

- **Folder naming**: `kebab-case` (e.g., `icon-button/`, `script-editor/`)
- **File naming**: `PascalCase` for TSX (e.g., `IconButton.tsx`)
- **No separate style files** — all styling is inline via Tailwind utility classes and CVA

### React Component Pattern

Follow this exact structure for all components:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const componentVariants = cva(
  "base-utility-classes here",
  {
    variants: {
      variant: {
        primary: "variant-specific-classes",
        secondary: "variant-specific-classes",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

type ComponentNameProps = {
  // ... other props
} & VariantProps<typeof componentVariants> &
  React.HTMLAttributes<HTMLDivElement>;

export function ComponentName({
  variant,
  className,
  ...rest
}: ComponentNameProps) {
  return (
    <div className={clsx(componentVariants({ variant }), className)} {...rest}>
      {/* content */}
    </div>
  );
}
```

**Key Patterns**:

1. **CVA for variants** — Use `class-variance-authority` for components with multiple visual variants
2. **`clsx` for class composition** — Combine CVA output, conditional classes, and `className` prop via `clsx()`
3. **Props type definition** — Define a `ComponentNameProps` type, extending `VariantProps<typeof variants>` and native HTML attributes
4. **Named export** — Use named exports (not default exports) for components
5. **Spread rest props** — Pass through additional HTML attributes via `...rest`
6. **Accept `className` prop** — Always allow parent components to extend styling via `className`
7. **Double quotes** — Always use double quotes for strings and JSX attributes
8. **`forwardRef` when needed** — Use `forwardRef` for components that expose a DOM ref

---

## Styling System — Tailwind CSS v4

### Architecture Overview

The styling system uses **Tailwind CSS v4** with **PostCSS**, combined with a **CSS custom property design token pipeline** and a **multi-theme override layer**. All configuration lives in `packages/renderer/src/assets/styles/`.

```text
tailwind.css          ← Entry point (imported once at app root)
  ├── base.css        ← :root CSS custom properties (primitives + semantic + component tokens + theme overrides)
  ├── theme.css       ← @theme inline (maps CSS vars → Tailwind utilities) + @theme (typography, spacing, animations)
  ├── utilities.css   ← @utility directives (custom scrollbar utilities, etc.)
  └── components.css  ← @layer components (styles requiring CSS: pseudo-elements, sibling combinators, attribute selectors)
```

> **Important**: `tailwind.css` is imported once in `options/index.tsx` as `import "../assets/styles/tailwind.css"`. All Tailwind utilities and CSS variables are globally available — **do NOT import style files directly into React components**.

### Key Libraries

| Library                       | Purpose                       | Usage                                               |
| ----------------------------- | ----------------------------- | --------------------------------------------------- |
| `tailwindcss` v4              | Utility-first CSS framework   | All component styling via utility classes in JSX    |
| `class-variance-authority`    | Type-safe variant management  | `cva()` for defining component variant classes      |
| `clsx`                        | Conditional class composition | Combining CVA output, conditionals, and `className` |
| `prettier-plugin-tailwindcss` | Automatic class sorting       | Prettier sorts Tailwind classes on format           |

### CSS Custom Properties — Token Pipeline

All design tokens are CSS custom properties defined on `:root` in `base.css`, following a 3-tier pipeline:

#### Tier 1: Primitives (prefix `--base-*`)

Raw design values. **Never reference these directly in Tailwind classes or component code.**

| Category             | Examples                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Core palette         | `--base-white`, `--base-grey`, `--base-blue`, `--base-gold`, `--base-red`                                     |
| Surfaces             | `--base-surface-base`, `--base-surface-raised`, `--base-surface-overlay`, `--base-surface-input`              |
| Borders              | `--base-border`, `--base-border-subtle`                                                                       |
| Text                 | `--base-text-muted`, `--base-text-muted-faint`, `--base-text-muted-strong`                                    |
| Accent               | `--base-accent`, `--base-accent-hover`, `--base-accent-muted`, `--base-accent-subtle`, `--base-accent-border` |
| Interactive overlays | `--base-hover-overlay`, `--base-active-overlay`                                                               |
| Danger               | `--base-danger`                                                                                               |
| Error states         | `--base-error-accent`, `--base-error-surface`, `--base-error-text-muted`, etc.                                |
| Syntax highlighting  | `--base-syntax-keyword`, `--base-syntax-function`, etc.                                                       |
| Component-specific   | Switch (`--base-switch-*`), Select (`--base-select-*`)                                                        |

#### Tier 2: Semantic Tokens

Intent-driven aliases referencing `--base-*` primitives. **These are the primary tokens — used in component code via Tailwind utility classes.**

| Category    | Variables                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Core        | `--accent`, `--accent-hover`, `--accent-muted`, `--accent-subtle`, `--accent-border`, `--danger`                                           |
| Layout      | `--foreground`, `--border`, `--border-subtle`                                                                                              |
| Surfaces    | `--surface-base`, `--surface-raised`, `--surface-overlay`, `--surface-input`                                                               |
| Text        | `--text-muted`, `--text-muted-faint`, `--text-muted-strong`                                                                                |
| Interactive | `--hover-overlay`, `--active-overlay`                                                                                                      |
| Error       | `--error-accent`, `--error-accent-soft`, `--error-glow`, `--error-surface`, `--error-surface-dark`, `--error-text-muted`, `--error-border` |
| Syntax      | `--syntax-keyword`, `--syntax-function`, `--syntax-param`, `--syntax-type`, `--syntax-punctuation`, `--syntax-comment`                     |
| Status      | `--info`, `--error`                                                                                                                        |
| Geometry    | `--geometry-border-radius: 4px`                                                                                                            |

#### Tier 3: Component Tokens

Themeable tokens for specific UI components:

- **Label**: `--label-foreground`
- **Switch**: `--switch-foreground`, `--switch-background`, `--switch-border`
- **Select**: `--select-background`, `--select-border`
- **Toast**: `--toast-foreground`, `--toast-shadow`, `--toast-info-*`, `--toast-warning-*`, `--toast-error-*`
- **Layout Spacing**: `--input-height`, `--page-padding`, `--section-padding`, `--section-gap`, `--field-gap`

### Tailwind Theme Registration (`theme.css`)

CSS custom properties are mapped to Tailwind utility classes via `@theme inline` (for CSS variable references) and `@theme` (for static values):

```css
@theme inline {
  --color-accent: var(--accent);
  --color-foreground: var(--foreground);
  --color-surface-base: var(--surface-base);
  /* ... maps semantic tokens → Tailwind color-* namespace */

  --radius-default: var(--geometry-border-radius);
}

@theme {
  --font-heading: "Outfit", "Open Sans", sans-serif;
  --font-body: "Open Sans", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  --spacing-2xs: 2px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-2xl: 24px;

  /* Named animations: --animate-page-reveal, --animate-panel-enter, etc. */
}
```

This means Tailwind utilities like `bg-surface-base`, `text-foreground`, `border-accent-border`, `font-mono`, `gap-md`, `rounded-default`, `animate-panel-enter` all resolve to the design tokens.

### Multi-Theme System

The application supports **8 UI themes** (1 default + 7 overrides) via `[data-theme]` attribute selectors in `base.css`:

| `data-theme` Value | Theme Name     |
| ------------------ | -------------- |
| _(default)_        | Graphite       |
| `graphite-warm`    | Graphite Warm  |
| `graphite-dusk`    | Graphite Dusk  |
| `graphite-ember`   | Graphite Ember |
| `obsidian`         | Obsidian       |
| `obsidian-deep`    | Obsidian Deep  |
| `obsidian-ember`   | Obsidian Ember |
| `obsidian-frost`   | Obsidian Frost |

Themes override `--base-*` primitives; semantic and component tokens cascade automatically. The `DevTools` → `ThemeSwitcher` manages theme switching at runtime.

### Typography

**Font Families** (available as Tailwind `font-*` utilities):

| Utility        | Font Stack                          | Usage                         |
| -------------- | ----------------------------------- | ----------------------------- |
| `font-heading` | `"Outfit", "Open Sans", sans-serif` | Headings                      |
| `font-body`    | `"Open Sans", sans-serif`           | Body text                     |
| `font-mono`    | `"JetBrains Mono", monospace`       | Code, inputs, buttons, labels |

**Typography Variants** are defined as CVA variants in the `Typography` component (`section-title`, `title`, `subtitle`, `body`, `caption`, `button`, `code`).

### Components Layer (`components.css`)

Styles that **cannot be expressed as Tailwind utilities** live in `@layer components` in `components.css`. Use this only for:

- Pseudo-element styling (`::before`, `::after`)
- Sibling combinators (`input:checked + .slider`)
- Attribute selectors (`[data-separator="hover"]`)
- Descendant overrides that need CSS specificity

Current component styles: Switch, Checkbox, Resize Handle, Theme Preview, ThemeSwitcher, ScriptMetadata.

### Custom Utilities (`utilities.css`)

Custom Tailwind utilities defined via `@utility` directive:

- `scrollbar-thin` — 4px thin scrollbar
- `scrollbar-thin-6` — 6px scrollbar with hover state
- `scrollbar-error` — 6px error-themed scrollbar

### Styling Patterns in Components

**Use Tailwind utility classes directly in JSX** — not separate CSS files:

```tsx
// ✅ CORRECT — Tailwind utilities + CVA variants + clsx composition
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono text-sm font-medium rounded-default cursor-pointer transition-colors duration-150",
  {
    variants: {
      variant: {
        primary: "bg-accent text-surface-base hover:bg-accent-hover",
        secondary: "bg-surface-overlay text-text-muted-strong border border-border hover:bg-hover-overlay",
      },
    },
  }
);

// In JSX:
<button className={clsx(buttonVariants({ variant }), className)}>

// ✅ CORRECT — Conditional classes with clsx
<div className={clsx("flex items-center gap-2", isActive && "text-accent", className)}>

// ❌ WRONG — Hardcoded colors or inline styles
<div style={{ backgroundColor: "#2d2d2d" }}>
<div className="bg-[#2d2d2d]">
```

### Important Styling Rules

1. **Tailwind-first** — Use Tailwind utility classes for all styling. Only use `components.css` for patterns that require CSS (pseudo-elements, sibling combinators)
2. **CVA for variants** — When a component has distinct visual variants, define them with `cva()`
3. **`clsx` for composition** — Combine CVA output, conditional classes, and forwarded `className` props
4. **Use design token utilities** — Always use token-mapped utilities (`bg-surface-base`, `text-foreground`, `border-accent-border`) — never hardcode colors via arbitrary values
5. **Accept `className` prop** — Components should accept and forward `className` for parent-level styling overrides
6. **Use the spacing scale** — Use `gap-sm`, `p-md`, `mt-lg`, etc. for consistent spacing
7. **Prettier auto-sorts** — Tailwind classes are automatically sorted by `prettier-plugin-tailwindcss` on format

---

## Design Aesthetic Guidelines

### Typography

The design system uses **Outfit** for headings, **Open Sans** for body text, and **JetBrains Mono** for code, inputs, buttons, and labels. Ensure:

- Proper hierarchy with `Typography` variants (`title`, `subtitle`, `section-title`, `body`, `caption`, `button`, `code`)
- Uppercase labels with `font-mono text-xs uppercase` for form labels
- JetBrains Mono (`font-mono`) for all interactive/code-related text
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

Apply subtle, purposeful animations via Tailwind `animate-*` utilities or `transition-*` classes:

- `animate-page-reveal` — Fade-in on page load (180ms)
- `animate-panel-enter` — Panel dropdown (150ms)
- `animate-select-reveal` — Select dropdown with scale (180ms)
- `animate-toast-slide-in` / `animate-toast-slide-out` — Toast notifications (200ms/150ms)
- `animate-pulse-indicator` — Pulsing save indicator (2s infinite)
- `transition-colors duration-150` — Standard interactive transitions

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
| `options`      | `packages/renderer/src/options/index.tsx`       | `options.js`      |
| `sass-sandbox` | `packages/renderer/src/sandbox/sass-sandbox.ts` | `sass-sandbox.js` |

> **Note**: The `popup` entry (`packages/renderer/src/popup/index.tsx`) is currently commented out pending implementation.

### Module Processing

| Scope                         | Loader                                                 | Config               |
| ----------------------------- | ------------------------------------------------------ | -------------------- |
| `packages/shared/src/*.ts`    | `esbuild-loader`                                       | Shared tsconfig      |
| `packages/monaco/src/*.ts`    | `esbuild-loader`                                       | Monaco tsconfig      |
| `packages/runtime/**/*.ts`    | `esbuild-loader`                                       | Runtime tsconfig     |
| `packages/renderer/**/*.tsx?` | `esbuild-loader` (`loader: "tsx"`, `jsx: "automatic"`) | Renderer tsconfig    |
| `.css`                        | `style-loader → css-loader → postcss-loader`           | Tailwind via PostCSS |
| `.ttf`                        | `asset/resource`                                       | Monaco editor fonts  |

**`noParse`**: `typescript.js` is excluded from parsing to improve build performance.

### Resolve Aliases

- `@` → `packages/renderer/src/`
- `@shared` → `packages/shared/src/`
- `@packages/monaco` → `packages/monaco/src/`
- `monaco-editor$` → `monaco-editor/esm/vs/editor/editor.api.js`

### Plugins

- `HtmlWebpackPlugin` (options)
- `MonacoEditorWebpackPlugin`
- `CopyWebpackPlugin` (manifest.json + images + sass-sandbox.html)
- `FaviconsWebpackPlugin`
- `ChromeExtensionReloaderWebpackPlugin` (development only — see Development Tooling)

### Chunk Splitting

Monaco editor is isolated into a separate chunk to optimize loading.

### Build Optimization

- **Minimizer**: `TerserPlugin` (production only, `extractComments: false`)
- **Split Chunks**: Monaco editor isolated into a named cache group with content-hashed filenames
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

| Option               | Value                                              |
| -------------------- | -------------------------------------------------- |
| `trailingComma`      | `"es5"`                                            |
| `plugins`            | `["prettier-plugin-tailwindcss"]`                  |
| `tailwindStylesheet` | `packages/renderer/src/assets/styles/tailwind.css` |
| `tailwindFunctions`  | `["clsx"]`                                         |

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
│       ├── tailwind.css              # Entry point (imports all style layers)
│       ├── base.css                  # :root CSS custom properties + theme overrides
│       ├── theme.css                 # @theme inline + @theme (Tailwind token registration)
│       ├── utilities.css             # @utility directives (scrollbar utilities)
│       └── components.css            # @layer components (pseudo-elements, sibling combinators)
├── options/                          # Options page (main IDE)
│   ├── index.html
│   ├── index.tsx                     # Entry: ErrorBoundary → Provider → InvertIde
│   └── invert-ide/
│       ├── InvertIde.tsx             # Root IDE component
│       ├── components/
│       │   ├── code-editor/          # Monaco editor wrapper (CodeEditor.tsx)
│       │   ├── dashboard-header/     # Decorative banner with syntax-highlighted snippet
│       │   └── sidebar/              # Navigation sidebar + SidebarNavButton
│       ├── contexts/
│       │   └── global-state.context.tsx
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
├── popup/                            # Extension popup (not yet implemented)
│   ├── index.html
│   └── index.tsx
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
    │   ├── editor-panel/             # Editor panel wrapper with inset styling
    │   ├── error-boundary/
    │   ├── icon-button/
    │   ├── input/
    │   ├── panel/                    # Dropdown overlay panel
    │   ├── resize-handle/
    │   ├── select/
    │   ├── switch/
    │   ├── tab-list/                 # Tabbed navigation (Tab, TabContent, TabListTitle)
    │   ├── toast/                    # Toast notifications (ToastProvider context)
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
├── index.ts                # Barrel: re-exports from shiki.ts, theming.ts, typescript/*
├── shiki.ts                # registerMonaco() — cached Shiki initialization entry point
├── theming.ts              # EditorThemes map, applyHighlighter(), getThemeOptions()
├── utils.ts                # CamelToKebabCase utility type
├── typescript/
│   ├── declarations.ts     # Shared script declaration generation (addExtraLib)
│   └── defaults.ts         # ensureTypescriptDefaults() configuration
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
├── webpack.config.ts          # Build configuration (3 entry points, loaders, plugins)
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
