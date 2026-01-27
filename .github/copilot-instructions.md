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

| Instead of... | Use...                           |
| ------------- | -------------------------------- |
| `<button>`    | `<Button>`                       |
| `<input>`     | `<Input>`                        |
| `<select>`    | `<Select>`                       |
| `<h1>`, `<p>` | `<Typography variant="...">`     |
| Icon button   | `<IconButton icon={LucideIcon}>` |

Import from `@/shared/components/`:

```tsx
import { Button } from "@/shared/components/button/Button";
import { Input } from "@/shared/components/input/Input";
import { Typography } from "@/shared/components/typography/Typography";
```

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

1. **SCSS import first** - Always import the component's SCSS file at the top
2. **Props type definition** - Define a `ComponentNameProps` type, extending native HTML attributes when appropriate
3. **Named export** - Use named exports (not default exports) for components
4. **Spread rest props** - Pass through additional HTML attributes via `...rest`
5. **Double quotes** - Always use double quotes for strings and JSX attributes

---

## SCSS Styling Patterns

### Styling Basics

- Import SCSS files directly into components: `import "./Component.scss"`
- **CSS Modules are NOT used** - use global SCSS with scoped class naming
- Global variables available in `packages/renderer/src/assets/styles/`:
  - `colors.scss` - Color palette
  - `typography.scss` - Font definitions
  - `theme.scss` - Theme-specific styles
  - `variables.scss` - CSS custom property generation

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

### CSS Variables Usage

**ALWAYS use CSS variables** from the design system. Never hardcode colors, typography, or geometry values.

```scss
// ✅ CORRECT - Use CSS variables
.my-component {
  color: var(--foreground);
  background-color: var(--input-background);
  font-family: var(--typography-input-font-family);
  font-size: var(--typography-input-font-size);
  border-radius: var(--geometry-border-radius);
}

// ❌ WRONG - Hardcoded values
.my-component {
  color: #f0f0f0;
  background-color: #2d2d2d;
  font-family: "Nunito Sans";
}
```

**Available CSS Variable Categories**:

| Category   | Prefix/Pattern              | Examples                                          |
| ---------- | --------------------------- | ------------------------------------------------- |
| Colors     | `--primary`, `--background` | `--primary`, `--foreground`, `--border`           |
| Nested     | `--{element}-{property}`    | `--input-background`, `--button-hover-background` |
| Typography | `--typography-{variant}-*`  | `--typography-title-font-size`                    |
| Geometry   | `--geometry-*`              | `--geometry-border-radius`                        |

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
```

### Important SCSS Rules

1. **Never import `variables.scss`** directly in components - CSS variables are globally available
2. **Use `rem` units** for sizing (not `px`) when possible
3. **Keep transitions short** - 0.2s to 0.3s for interactive elements
4. **Scope all styles** under a component-specific class to avoid conflicts

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

## Design Aesthetic Guidelines

### Typography

The design system uses **Open Sans** for headings and **Nunito Sans** for UI elements. Ensure:

- Proper hierarchy with `Typography` variants (`title`, `subtitle`, `body`, `caption`)
- Uppercase labels with `text-transform: uppercase` for form labels
- Appropriate font weights from the typography scale

### Color & Theme

The palette is **dark-themed** with:

- Dark backgrounds (`#1e1e1e`, `#2d2d2d`)
- Light foregrounds (`#f0f0f0`)
- **Orange accent** (`#ffba00`) for primary actions and highlights
- **Blue primary** (`#1868c4`) for interactive elements

Use the established color tokens; do not introduce new colors without updating the design system.

### Motion & Interaction

Apply subtle, purposeful animations:

```scss
// Smooth state transitions
transition: background-color 0.2s ease;

// Keyframe animations for special effects
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

- Layered backgrounds using gradients
- Subtle borders with transparency (`rgba(255, 255, 255, 0.1)`)
- Backdrop blur for overlay effects (`backdrop-filter: blur(12px)`)
- Ambient glow effects for visual interest

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
