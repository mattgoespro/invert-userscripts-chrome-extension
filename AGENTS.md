# AGENTS.md

## Development checkout

Work directly in the primary checkout on `main`. Use another branch or a linked worktree only when the user explicitly requests it. The user tests the primary checkout's `dist/` build.

## Project Overview

**Invert IDE** is a Chrome extension (Manifest V3) that provides an integrated TypeScript/SCSS IDE directly in the browser. Users can write, manage, and inject JavaScript userscripts with a Monaco editor, combining development tooling with script injection capabilities. The extension compiles TypeScript and SCSS in-browser, formats code with Prettier, and programmatically injects compiled scripts into matching web pages.

## Architecture & Monorepo Structure

The project follows a monorepo architecture with four distinct packages:

| Package             | Purpose                                                           | Key Technologies                                                |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/renderer` | React-based UI for the Options page (IDE) and extension Popup     | TypeScript, React 19, React Redux, Redux Toolkit, Monaco Editor |
| `packages/runtime`  | Background service workers and content scripts                    | TypeScript, Chrome Extensions API                               |
| `packages/shared`   | Common types, storage wrappers, and message definitions           | TypeScript                                                      |
| `packages/monaco`   | Monaco editor integration, Shiki tokenizer, and theme definitions | TypeScript, Monaco Editor, Shiki                                |

## Key Developer Workflows

### Build & Run

| Command          | Description                                         |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Run Webpack in watch mode for development           |
| `npm run build`  | Production build                                    |
| `npm run lint`   | Run ESLint across all packages, tools, and examples |
| `npm run format` | Run Prettier to format all files                    |
| `npm run clean`  | Remove the `dist` directory and webpack cache       |

Additional verification scripts are `pnpm test` (node:test), `pnpm check:manifest`, `pnpm e2e:headless`, and root/tools TypeScript checks. The repository uses `pnpm` as its package manager, even when examples show `npm run ...`, and `npm run clean` shells out to `rm -rf`.

### Path Aliases

- `@shared/*` → Maps to `packages/shared/src/*`. Use for importing shared logic across packages.
- `@packages/monaco` → Maps to `packages/monaco/src/index.ts`. Use for importing Monaco editor integration, themes, and utilities.
- `@/*` → Maps to `./src/*` within the renderer package (e.g., `@/shared/components` → `packages/renderer/src/shared/components`).

## Build System (Webpack)

Treat `webpack.config.ts` as a coupled extension build manifest. Entry points, copied assets, Monaco bundling, manifest rewriting, and dev reloader behavior are coordinated.

## Chrome Extension Configuration

### Manifest V3 (`public/manifest.json`)

| Setting          | Value / Details                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| Permissions      | `storage`, `activeTab`, `scripting`, `webNavigation`, `userScripts`, `alarms` |
| Host Permissions | `<all_urls>`                                                                  |
| Background       | Service worker: `background.js`                                               |
| Action           | Popup: `popup.html`                                                           |
| Options          | `options.html` (opens in new tab)                                             |
| Sandbox          | `sass-sandbox.html` (for WASM SCSS compilation)                               |
| CSP (pages)      | Allows `wasm-unsafe-eval` for TS/SCSS compilation                             |
| CSP (sandbox)    | Allows `unsafe-eval` for dart-sass                                            |

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

### Prettier Configuration

Consistent code formatting is enforced via Prettier (`prettier.config.mjs`):

| Option               | Value                                              |
| -------------------- | -------------------------------------------------- |
| `trailingComma`      | `"es5"`                                            |
| `plugins`            | `["prettier-plugin-tailwindcss"]`                  |
| `tailwindStylesheet` | `packages/renderer/src/assets/styles/tailwind.css` |
| `tailwindFunctions`  | `["clsx"]`                                         |

## TypeScript Configuration

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

## TypeScript Best Practices

When writing, refactoring, or updating TypeScript code:

1. **Use explicit types** for function parameters and return values
2. **Avoid `any`** — prefer specific types or `unknown` with type guards
3. **Use `interface` for object shapes** and `type` for unions/intersections
4. **Use `as const` for literal types** when appropriate (e.g. action type constants)
5. **Leverage TypeScript's type inference** where possible, but be explicit in public APIs
6. **Use scoped control flow blocks** (e.g., `if`, `for`, `try/catch`) with proper block scoping and avoid single-line statements without braces
7. **Use `error` as the variable name in `catch` blocks** for consistency
8. **Use `event` as the variable name for event handlers** for clarity

### Additional Rules

For additional code quality, refer to the ESLint rules defined in `eslint.config.mjs`, especially those related to TypeScript and React.

## Cursor Cloud specific instructions

This repo is a **Chrome MV3 extension** ("Invert IDE Userscripts") built as a pnpm workspace
(`packages/*`, `plugins`, `examples/*`). It is 100% client-side: there is **no backend server,
remote database, or backend API**. Persistence uses `chrome.storage` and opt-in local IndexedDB. The "app" is the built `dist/` folder
loaded into Chrome as an unpacked extension.

Toolchain: Node + `pnpm@10.33.0` (see `packageManager`). After checkout, run `pnpm install`.

### Building (important gotcha)

`webpack.config.ts` is a **TypeScript** config in an **ESM** package, and `pnpm build` /
`pnpm dev` (`webpack ...`) fail on their own with
`ERR_UNKNOWN_FILE_EXTENSION ".ts"`. Webpack must load the TS config via the ts-node ESM loader.
Always run build/dev with:

```bash
TS_NODE_PROJECT=tsconfig.tools.json NODE_OPTIONS='--loader ts-node/esm' pnpm build   # -> dist/
TS_NODE_PROJECT=tsconfig.tools.json NODE_OPTIONS='--loader ts-node/esm' pnpm dev     # watch + hot-reload WS on :8081
```

The build emits harmless "asset size limit" warnings (Monaco bundles are large) and still exits 0.

### Lint / format

`pnpm lint` (eslint) and `pnpm format` (prettier) work as-is, no special env needed.
Run `pnpm test` for the node:test suites and Playwright for extension browser checks.

### End-to-end tests (Playwright)

E2E loads the built extension into Chromium, so you **must build `dist/` first**
(`e2e/global-setup.ts` asserts `dist/manifest.json` exists). If you hit an error suggesting `npm run build`, use the build command from the section above (ts-node ESM loader).
Chrome extensions require a real/new headless mode, which the fixtures handle through the project headless option and `--headless=new`.

```bash
# one-time browser binary install (done in setup): pnpm exec playwright install --with-deps chromium
pnpm e2e            # headed
pnpm e2e:headless   # new headless mode, no persistent display needed
```

Current refactor evidence and remaining release gates: `docs/architecture/refactor-validation.md`.
The browser fixture explicitly enforces CSP and uses Chrome's real User Scripts toggle.

### Manually running the extension

Build `dist/`, then load it in Chrome via `chrome://extensions` → Developer Mode → "Load unpacked"
→ select `dist/`, or launch Chrome with `--load-extension=<abs>/dist`. Surfaces: popup
(`popup.html`), the IDE/options page (`options.html`, opens in a tab), background service worker,
and the sass sandbox (`sass-sandbox.html`).

## Publication boundaries

All source/module/settings/artifact mutations use the background protocol, including legacy-mode writer admission. Do not call Legacy storage mutators from renderer code. Active IndexedDB commits atomically persist revisions, receipts, sync outbox and pending CSS reconciliation. Draft checkpoints, UI layout, type caches and CSS session bookmarks remain local exceptions. Ordinary saves must not absorb unresolved sync heads; only explicit generation-checked resolution joins branches. Retain legacy decoders and recovery until the upgraded cohort is validated.

Monaco model identity uses the immutable script ID; public import aliases remain `scripts/<module>/main|types`. Keep the build worker/Sass sandbox and avoid compiler dependencies in popup/background.
