# Copilot Instructions

## Project Overview

**Invert IDE** is a Chrome extension that provides an integrated TypeScript/SCSS IDE directly in the browser. Users can write, manage, and inject JavaScript userscripts with a Monaco editor, combining development tooling with script injection capabilities.

---

## Architecture & Monorepo Structure

The project follows a monorepo architecture with three distinct packages:

| Package             | Purpose                                                       | Key Technologies                       |
| ------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `packages/renderer` | React-based UI for the Options page (IDE) and extension Popup | React 19, Redux Toolkit, Monaco Editor |
| `packages/runtime`  | Background service workers and content scripts                | Chrome Extensions API                  |
| `packages/shared`   | Common types, storage wrappers, and message definitions       | TypeScript                             |

### Package Dependencies

- `packages/renderer` → depends on `packages/shared`
- `packages/runtime` → depends on `packages/shared`
- `packages/shared` → standalone (no internal dependencies)

---

## Key Developer Workflows

### Build & Run

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Run Webpack in watch mode for development |
| `npm run build`  | Production build                          |
| `npm run lint`   | Run ESLint across all packages and tools  |
| `npm run format` | Run Prettier to format all files          |
| `npm run clean`  | Remove the `dist` directory               |

### Path Aliases

- `@shared/*` → Maps to `packages/shared/src/*`. Use for importing shared logic across packages.
- `@/*` → Maps to `./src/*` within a specific package (e.g., in `packages/renderer`, `@/shared/components` → `packages/renderer/src/shared/components`).

---

## Data Models

Core data types are defined in `packages/shared/src/model.ts`:

- **`Userscript`**: Represents a user-created script with TypeScript/SCSS code, URL patterns, and execution timing.
- **`GlobalModule`**: External JavaScript modules that can be injected globally.
- **`EditorSettings`**: Monaco editor configuration (theme, font size, tab size, etc.).

---

## State Management & Persistence

### Storage Strategy

All persistence is handled via `chrome.storage.sync`, abstracted by `StorageManager` in `packages/shared/src/storage.ts`.

### Hybrid State Patterns

| State Type                           | Pattern                                                          | Example                                                          |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Complex State** (Userscripts)      | Redux Toolkit + Redux Observable (Epics)                         | `packages/renderer/src/shared/store/slices/userscripts.slice.ts` |
| **Simple State** (Modules, Settings) | Direct `StorageManager` access with `useState` and async effects | ModulesPage component                                            |

#### Redux Flow for Userscripts

1. Action dispatched (e.g., `saveUserscript`)
2. Slice reducer updates Redux state
3. Epic intercepts action and handles async storage persistence
4. See: `packages/renderer/src/shared/store/epics/userscripts.epics.ts`

---

## Component & Styling Guidelines

### UI Components

Use the custom component library in `packages/renderer/src/shared/components`:

- `Button` - Standard buttons
- `IconButton` - Icon-only buttons
- `Input` - Text inputs
- `Select` - Dropdown selects
- `Checkbox` - Checkboxes
- `Switch` - Toggle switches
- `Typography` - Text elements

**Do NOT use raw HTML elements** (e.g., `<button>`, `<input>`) when a custom component exists.

### Styling

- Import SCSS files directly into components: `import "./Component.scss"`
- **CSS Modules are NOT used** - use global SCSS with scoped class naming
- Follow BEM-like naming or block-element nesting for class names
- Global variables available in `packages/renderer/src/assets/styles/`:
  - `colors.scss` - Color palette
  - `typography.scss` - Font definitions
  - `theme.scss` - Theme-specific styles
  - `variables.scss` - CSS custom property generation

### CSS Variable Generation

The `generate-variables` mixin in `variables.scss` recursively converts nested SCSS maps into CSS custom properties on `:root`. The naming convention uses hyphen-delimited paths:

> **Important**: `variables.scss` is imported once at the app root level. **Do NOT import it directly into React components** - the CSS variables are globally available via `var()` syntax.

**How it works:**

1. Takes a SCSS map and optional prefix
2. For each key-value pair:
   - If value is a nested map → recurses with `prefix-key` as new prefix
   - If value is a primitive → outputs `--prefix-key: value`

**Example transformation:**

```scss
// Input: colors.$palette (nested map)
$palette: (
  primary: #1868c4,
  input: (
    foreground: #f0f0f0,
    background: #2d2d2d,
  ),
);

// Output CSS (no prefix for palette)
:root {
  --primary: #1868c4;
  --input-foreground: #f0f0f0;
  --input-background: #2d2d2d;
}
```

```scss
// Input: typography.$typography with "typography" prefix
$typography: (
  title: (
    font-size: 1.5rem,
    font-weight: bold,
  ),
  body: (
    font-size: 0.5rem,
  ),
);

// Output CSS
:root {
  --typography-title-font-size: 1.5rem;
  --typography-title-font-weight: bold;
  --typography-body-font-size: 0.5rem;
}
```

**Usage in components:**

```scss
.my-component {
  color: var(--primary);
  background: var(--input-background);
  font-size: var(--typography-body-font-size);
  border-radius: var(--geometry-border-radius);
}
```

---

## Communication Architecture

### Extension Messaging

All messaging is type-safe via definitions in `packages/shared/src/messages.ts`:

- `RuntimePortMessageEvent` - Defines message payload contracts
- `RuntimePortMessageSource` - Valid message sources: `"background"`, `"options"`, `"popup"`, `"content-script"`

### Message Handlers

- Located in `packages/runtime/src/handlers/`
  - `extension-handlers/` - Chrome runtime and navigation handlers
  - `component-handlers/` - Tab and UI-related handlers
- Background script (`packages/runtime/src/background.ts`) routes messages centrally

---

## Code Quality & Linting

### ESLint Configuration

The project uses a shared ESLint configuration with package-specific extensions:

**Root Configuration** (`eslint.config.mjs`):

- TypeScript-ESLint recommended rules
- Ignores `node_modules/` and `dist/`

**Key Rules**:

| Rule                                 | Setting | Notes                               |
| ------------------------------------ | ------- | ----------------------------------- |
| `@typescript-eslint/no-unused-vars`  | `warn`  | Ignores variables prefixed with `_` |
| `@typescript-eslint/no-explicit-any` | `warn`  | Prefer explicit types               |
| `no-unused-vars`                     | `off`   | Deferred to TypeScript rule         |

**Package-Specific**:

- `packages/renderer`: Adds React plugin with JSX support (`react/react-in-jsx-scope: off`)
- `packages/runtime`: Standard TypeScript rules
- `packages/shared`: Standard TypeScript rules

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
3. **Limit line length to 100 characters** - break long lines appropriately
4. **Use 2-space indentation** (no tabs)
5. **Include trailing commas** in multi-line arrays/objects (ES5 style)
6. **Prefix unused variables with `_`** to avoid lint warnings (e.g., `_unusedParam`)
7. **Avoid `any` types** - use explicit types or `unknown` with type guards
8. **Run `npm run lint`** mentally before suggesting code to ensure compliance

---

## TypeScript Configuration

### Composite Project Structure

The project uses TypeScript project references:

```
tsconfig.json (root)
├── tsconfig.base.json (shared compiler options)
├── packages/shared/tsconfig.json
├── packages/runtime/tsconfig.json
└── packages/renderer/tsconfig.json
```

### Key TypeScript Compiler Options

- **Target**: ES2020
- **Module**: ESNext with Node module resolution
- **JSX**: `react-jsx` (in renderer package)
- **Strict Mode**: Disabled at base level (consider enabling for new code)
- **Path Aliases**:
  - `@shared/*` → `packages/shared/src/*`
  - `@/*` → `./src/*` within each package
- **Source Maps**: Enabled for easier debugging in development
- **noImplicitAny**: true
- **forceConsistentCasingInFileNames**: true
- **noImplicitThis**: true

---

## File Organization

### Renderer Package Structure

```
packages/renderer/src/
├── assets/           # Images and global styles
├── options/          # Options page (main IDE)
│   ├── invert-ide/   # Main IDE component
│   │   ├── code-editor/    # Monaco editor wrapper
│   │   ├── pages/          # IDE pages (scripts, modules, settings)
│   │   └── sidebar/        # Navigation sidebar
├── popup/            # Extension popup
└── shared/           # Shared components and state
    ├── components/   # Reusable UI components
    └── store/        # Redux store, slices, and epics
```

### Runtime Package Structure

```
packages/runtime/src/
├── background.ts     # Service worker entry point
├── content/          # Content scripts
├── handlers/         # Message handlers
│   ├── component-handlers/
│   └── extension-handlers/
└── ide/              # Script execution logic
```
