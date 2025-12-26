# Chrome Vertex IDE Userscripts Extension - AI Instructions

## Project Overview

This is a Chrome Extension that provides an integrated browser and IDE for bundling and injecting TypeScript userscripts. It features a monorepo-like structure managed via TypeScript project references and Webpack.

## Architecture & File Structure

The codebase is organized into three main packages under `packages/`:

- **`packages/renderer/`**: The UI layer (React 19).
  - **Options Page:** The main IDE interface (`src/options/vertex-ide/`).
  - **Popup:** Quick access menu (`src/popup/`).
  - **Styling:** SCSS files co-located with components (e.g., `VertexIde.tsx` and `VertexIde.scss`).
  - **Editor:** `monaco-editor` integration for code editing.
- **`packages/runtime/`**: The extension's background and content logic.
  - **`src/background.ts`**: Service worker entry point.
  - **`src/ide/scripts.ts`**: Core logic for script injection using `chrome.scripting.executeScript` with `world: 'MAIN'`.
  - **`src/handlers/`**: Event handlers (e.g., `runtime.handler.ts` for messages).
- **`packages/shared/`**: Common code shared between renderer and runtime.
  - **`src/model.ts`**: Domain models (`UserScript`, `ScriptFile`, `GlobalModule`).
  - **`src/storage.ts`**: `IDEStorageManager` wrapper for `chrome.storage.sync`.
  - **`src/compiler.ts`**: In-browser `TypeScriptCompiler` using the `typescript` package.

## Key Conventions & Patterns

### Message Passing

- **Pattern:** `{ action: 'actionName', payload?: any }`.
- **Handler:** `packages/runtime/src/handlers/extension-handlers/runtime.handler.ts`.
- **Reloading:** Sending `{ action: 'reloadScripts' }` triggers `injectMatchingScripts` on all tabs.

### UI Development

- **Framework:** React 19 with Hooks.
- **Styling:** SCSS modules imported directly (`import './Component.scss'`).
- **State:** Local state for UI, `IDEStorageManager` for persistent data.
- **Monaco:** Workers are configured in `webpack.config.ts`.

## Build & Development

- **Build System:** Webpack with `ts-loader`.
- **Config:** `webpack.config.ts` handles entry points (`background`, `popup`, `options`, `monaco` workers).
- **Aliases:**
  - `@shared/*` -> `packages/shared/src/*`
  - `@/*` -> `packages/renderer/src/*`
  - `~/theme` -> `packages/renderer/src/assets/styles/theme.scss`
- **Commands:**
  - `npm run dev`: Webpack watch mode.
  - `npm run build`: Production build to `dist/`.

## TypeScript Conventions

- Do not use or suggest using `any`; prefer strict types.
