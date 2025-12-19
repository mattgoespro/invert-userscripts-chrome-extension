# Chrome Vertex IDE Userscripts Extension - AI Instructions

## Project Overview

This is a Chrome Extension that provides an integrated browser and IDE for bundling and injecting TypeScript userscripts. It uses a monorepo-like structure managed via TypeScript project references and Webpack.

## Architecture & File Structure

The codebase is organized into three main packages under `packages/`:

- **`packages/renderer/`**: The UI layer (React 19).
  - Contains the Options page (main IDE), Popup, and Sidebar.
  - **Pattern:** Components are co-located with their SCSS files (e.g., `VertexIde.tsx` and `VertexIde.scss`).
- **`packages/runtime/`**: The extension's background and content logic.
  - **`src/background.ts`**: Entry point for the service worker.
  - **`src/handlers/`**: Logic is split into handlers (e.g., `runtime.handler.ts` for messages, `navigation.handler.ts` for navigation events).
  - **`src/ide/`**: Core logic for script injection and management.
- **`packages/shared/`**: Common code shared between renderer and runtime.
  - **`src/model.ts`**: TypeScript interfaces for data models (`UserScript`, `ScriptFile`, `AppSettings`).
  - **`src/storage.ts`**: `IDEStorageManager` class wrapping `chrome.storage.sync`.
  - **Import Alias:** Use `@shared/*` to import from this package (e.g., `import { UserScript } from '@shared/model'`).

## Key Conventions & Patterns

### Data Persistence

- **NEVER** use `chrome.storage` directly in components or business logic.
- **ALWAYS** use `IDEStorageManager` from `@shared/storage` for all data operations.
- Data is synced via `chrome.storage.sync`.

### Message Passing

- Runtime message listeners are defined in `packages/runtime/src/handlers/extension-handlers/runtime.handler.ts`.
- Use the `action` property in messages to dispatch tasks (e.g., `{ action: 'reloadScripts' }`).

### UI Development

- **Framework:** React 19 with Hooks.
- **Styling:** SCSS. Create a `.scss` file next to the component and import it directly (`import './Component.scss'`).
- **Editor:** Uses `monaco-editor` for code editing capabilities.

### Build & Development

- **Build System:** Webpack with `ts-loader`.
- **Config:** `webpack.config.ts` handles the build configuration for all entry points.
- **Commands:**
  - `npm run dev`: Runs Webpack in watch mode for development.
  - `npm run build`: Builds the extension for production (output to `dist/`).
  - `npm run lint`: Runs ESLint.

## Critical Files

- `packages/shared/src/model.ts`: Domain models.
- `packages/shared/src/storage.ts`: Data access layer.
- `packages/runtime/src/background.ts`: Service worker entry point.
- `webpack.config.ts`: Build configuration.

## Coding Conventions

- Never use `any` type; prefer explicit types or generics when possible.
- Always use loose, explicit `null` checks instead of truthy/falsy checks, unless checking for booleans or in cases where `null` and `undefined` represent different states.
- Use descriptive variable and function names.
- Write modular, reusable functions.
- Add comments for complex logic or non-obvious decisions.
- Use async/await for asynchronous operations.
- Follow existing code patterns for consistency.
- Follow TypeScript best practices for type safety.
