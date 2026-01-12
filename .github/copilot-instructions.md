# Copilot Instructions

## Architecture & Vision
- **Monorepo Structure**: The project is organized into three distinct packages:
  - `packages/renderer`: React-based UI for the Options page (the core IDE) and Popup.
  - `packages/runtime`: Background service workers and content scripts (extension logic).
  - `packages/shared`: Common types, storage wrappers, and message definitions.
- **Core Purpose**: An "Invert IDE" extension that allows users to write/manage TypeScript userscripts in the browser with a Monaco editor.

## Key Developer Workflows
- **Build & Run**:
  - `npm run dev`: Runs Webpack in watch mode for development.
  - `npm run build`: specialized production build.
- **Path Aliases**:
  - `@shared/*`: Maps to `packages/shared/src/*`. Use this to import shared logic.
  - `@/*`: Maps to `./src/*` within a specific package (e.g., `packages/renderer/src`).

## State Management & Persistence
- **Storage Strategy**: All persistence is handled via `chrome.storage.sync`, abstracted by `StorageManager` in `packages/shared/src/storage.ts`.
- **Hybrid State Patterns**:
  - **Complex State (Userscripts)**: Uses **Redux Toolkit** + **Redux Observable (Epics)**.
    - Pattern: Action dispatched -> Slice updates state -> Epic handles async storage persistence.
    - See: `packages/renderer/src/shared/store/epics/userscripts.epics.ts`.
  - **Simple State (Modules)**: Components may read/write `StorageManager` directly using `useState` and async effects.

## Component & Styling Guidelines
- **UI Components**: Use the custom component library located in `packages/renderer/src/shared/components` (e.g., `Button`, `Input`, `Select`) instead of raw HTML elements to maintain consistency.
- **Styling**: Use global SCSS files imported directly into components (e.g., `import "./Component.scss"`).
  - **Note**: CSS Modules are **NOT** used.
  - Follow BEM-like naming or block-element nesting for class names.

## Communication Architecture
- **Type-Safety**: All extension messaging must use typed events defined in `packages/shared/src/messages.ts`.
- **Message Flow**:
  - `RuntimePortMessageEvent` defines the payload contract.
  - Handlers are located in `packages/runtime/src/handlers`.
  - Background script (`packages/runtime/src/background.ts`) routes messages centrally.
