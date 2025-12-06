# GitHub Copilot Instructions for Chrome Vertex IDE Userscripts Extension

## Project Overview

This is a Chrome Extension project structured as a monorepo-style workspace. It provides an in-browser IDE (using Monaco Editor) for writing and injecting TypeScript userscripts.

### Core Architecture

- **`packages/renderer/`**: React-based UI for Popup and Options pages. Uses `shadcn/ui` and SCSS.
- **`packages/runtime/`**: Background scripts, content scripts, and extension event handlers.
- **`packages/shared/`**: Common types, utilities, and storage logic shared between renderer and runtime.
- **`webpack.config.ts`**: Central build configuration handling multiple entry points (background, popup, options, Monaco workers).

## Critical Developer Workflows

### Build & Run

- **Development**: Run `npm run dev` to start Webpack in watch mode.
- **Production**: Run `npm run build` for a minified production build.
- **Reloading**: The project uses a custom `ChromeExtensionReloaderWebpackPlugin`. Ensure the extension is reloaded in `chrome://extensions` if changes aren't picked up.

### Dependencies

- **UI Library**: `shadcn/ui` components are located in `packages/renderer/src/lib/components/ui`.
- **Monaco Editor**: Configured via `monaco-editor-webpack-plugin`. Worker entry points are defined in `webpack.config.ts`.

## Architectural Patterns & Conventions

### 1. Service Boundaries

- **Strict Separation**: Never import `renderer` code into `runtime` or vice-versa.
- **Shared Code**: All shared logic (types, storage wrappers, constants) MUST reside in `packages/shared`.
- **Communication**: Use `chrome.runtime.sendMessage` for communication between UI and Background.

### 2. Event Handling (`packages/runtime`)

- **Pattern**: Event handlers are isolated in `packages/runtime/src/handlers/`.
- **Registration**: Handlers are imported and registered in `packages/runtime/src/background.ts`.
- **Example**:

  ```typescript
  // handlers/extension-handlers/runtime.handler.ts
  export const onMessage = (request, sender, sendResponse) => { ... }

  // background.ts
  chrome.runtime.onMessage.addListener(onMessage);
  ```

### 3. State Management & Storage

- **Persistence**: Use `IDEStorageManager` in `packages/shared/src/storage.ts` for all `chrome.storage` operations.
- **Sync**: The extension uses `chrome.storage.sync` for cross-device synchronization of scripts and settings.
- **Data Models**: Define all data interfaces (e.g., `UserScript`, `AppSettings`) in `packages/shared/src/model.ts`.

### 4. UI Development (`packages/renderer`)

- **Components**: Prefer `shadcn/ui` components.
- **Styling**: Use SCSS modules or global SCSS (`packages/renderer/src/styles/globals.scss`).
- **Entry Points**: `popup/index.tsx` and `options/index.tsx` are the main React roots.

## Common Tasks

### Adding a New Feature

1. Define types in `packages/shared/src/model.ts`.
2. Implement storage logic in `packages/shared/src/storage.ts`.
3. Create UI components in `packages/renderer`.
4. Add message handlers in `packages/runtime/src/handlers` if background processing is needed.
5. Register the handler in `packages/runtime/src/background.ts`.

### Working with Monaco

- Monaco workers are bundled separately.
- Configuration for the editor instance should be done within the React components wrapping Monaco.
