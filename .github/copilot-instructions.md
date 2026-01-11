# Copilot Instructions for Invert IDE Userscripts Extension

## Project Overview

This is a Chrome extension that provides a browser-based IDE for creating, editing, and managing TypeScript userscripts. It combines Monaco Editor with in-browser TypeScript compilation and Chrome's scripting APIs to inject custom scripts into web pages.

## Architecture: 3-Package Monorepo

### Package Structure

- **`packages/shared/`**: Core models, Chrome storage manager, and TypeScript compiler
  - Used by both runtime and renderer packages via `@shared/*` path alias
  - Pure TypeScript with no React dependencies
  
- **`packages/runtime/`**: Chrome extension background worker (MV3 service worker)
  - Entry: `src/background.ts` - registers event listeners for Chrome extension APIs
  - Script injection: `src/ide/scripts.ts` - matches URL patterns and injects userscripts via `chrome.scripting.executeScript`
  - Handlers follow naming convention: `*-handlers/[feature].handler.ts`

- **`packages/renderer/`**: React UI (popup & options pages)
  - Uses Redux Toolkit + redux-observable for state management
  - Monaco Editor integration for TypeScript/SCSS editing
  - Path alias `@/` points to `packages/renderer/src/`

### Chrome Extension Pages

- **Popup** (`popup.html`): Quick status view from browser toolbar icon
- **Options** (`options.html`): Full IDE interface with Monaco Editor, script management, and settings

## Build System

### Webpack Configuration (`webpack.config.ts`)

- **Multiple entry points**: background, popup, options compiled separately
- **Loader strategy by package**:
  - `packages/shared`: Uses `esbuild-loader` with shared tsconfig
  - `packages/runtime`: Uses `esbuild-loader` with runtime tsconfig  
  - `packages/renderer`: Uses `ts-loader` (required for React TSX)
- **Development mode**: Custom `ChromeExtensionReloaderWebpackPlugin` auto-reloads extension on changes via WebSocket
- **Monaco Editor**: Uses `monaco-editor-webpack-plugin` with TypeScript/SCSS language support

### Commands

```bash
npm run dev        # Development build with watch mode and auto-reload
npm run build      # Production build with minification
npm run lint       # ESLint on packages/ and tools/
npm run format     # Prettier formatting
npm run clean      # Remove dist/ directory
```

**Note**: Build commands may require Node.js ESM loader configuration for TypeScript webpack config.

## Key Patterns & Conventions

### State Management (Redux Observable + RTK)

- **Slices**: `packages/renderer/src/shared/store/slices/userscripts.slice.ts`
  - Use RTK's `createSlice` with auto-generated actions and selectors
  - Export selectors as named exports: `selectAllUserscripts`, `selectCurrentUserscript`
  - Use `createAsyncThunk` for async operations (e.g., `loadUserscripts`)

- **Epics**: `packages/renderer/src/shared/store/epics/userscripts.epics.ts`
  - Side effects handled via redux-observable's RxJS streams
  - Automatically persist state changes to Chrome storage
  - Combined in `root-epic.ts`

### Chrome Storage Pattern

All data persistence uses `chrome.storage.sync` via `StorageManager` class (`packages/shared/src/storage.ts`):
- Userscripts stored as `Record<string, Userscript>` with UUID keys
- Always use `StorageManager` methods; never access `chrome.storage` directly
- Methods are async and return Promises

### TypeScript Compilation

In-browser compilation via `TypeScriptCompiler` class (`packages/shared/src/compiler.ts`):
- `compile()`: Transpiles TypeScript to JavaScript using `transpileModule`
- `typeCheck()`: Returns diagnostic errors without emitting code
- Target: ES2020, Module: ESNext

### URL Pattern Matching

Scripts match pages via glob patterns (`packages/runtime/src/ide/scripts.ts`):
- Patterns converted to regex: `*` → `.*`, `?` → `.`
- Example: `https://github.com/*` matches all GitHub pages
- Always escape regex special chars before glob conversion

### Script Injection

- Scripts execute in `world: "MAIN"` (page context, not isolated)
- Code wrapped in `<script>` element injected into `document.head`
- Uses `chrome.scripting.executeScript` API (requires Manifest V3)

## Development Setup

1. `npm install` - Install dependencies
2. `npm run dev` - Start webpack in watch mode
3. Load `dist/` folder as unpacked extension in Chrome
4. Extension auto-reloads on file changes (dev mode only)

## Code Style

- ESLint config: `eslint.config.mjs` using typescript-eslint
- Unused vars allowed if prefixed with `_`
- `@typescript-eslint/no-explicit-any` is warning, not error
- Prettier for formatting (tabs: 2 spaces)

## Common Gotchas

- **Don't mix loaders**: Renderer uses ts-loader, others use esbuild-loader
- **Path aliases differ**: `@shared/*` is monorepo-wide, `@/` is renderer-only
- **Monaco in production**: CSP requires `'wasm-unsafe-eval'` for WebAssembly
- **Storage sync limits**: Chrome storage.sync max 100KB per item, 512 items total
