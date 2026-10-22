import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import { GlobalStateManager } from "@shared/storage";
import editorDraftsReducer from "./slices/editor-drafts";
import {
  ensureDraft,
  resolveAllConflictsTakeRemote,
  resolveConflictTakeRemote,
} from "./slices/editor-drafts";
import editorReducer from "./slices/code-editor";
import modulesReducer from "./slices/modules";
import settingsReducer from "./slices/settings";
import {
  setCurrentUserscript,
  syncScriptsFromRemote,
} from "./slices/userscripts";
import userscriptsReducer from "./slices/userscripts";
import uiReducer, {
  hydrateUi,
  toPersistedGlobalState,
  type UiState,
} from "./slices/ui";
import { loadUserscripts } from "./slices/userscripts/thunks.load";
import workspaceReducer from "./slices/workspace";

// Webpack replaces this expression; the renderer has no Node runtime.
declare const process: { env: { NODE_ENV: string } };
const isDevelopment = process.env.NODE_ENV === "development";

const listenerMiddleware = createListenerMiddleware();

const UI_SAVE_DEBOUNCE_MS = 500;
let uiSaveTimer: ReturnType<typeof setTimeout> | null = null;

function flushUiState(ui: UiState) {
  if (!ui.hydrated) {
    return;
  }

  void GlobalStateManager.save(toPersistedGlobalState(ui));
}

function restoreSelectedUserscript(listenerApi: {
  dispatch: (action: unknown) => void;
  getState: () => unknown;
}) {
  const state = listenerApi.getState() as RootState;
  const scripts = state.userscripts.scripts ?? {};
  const scriptIds = Object.keys(scripts);

  if (scriptIds.length === 0) {
    return;
  }

  const currentId = state.userscripts.currentScriptId;

  // Only select when nothing valid is current.
  if (currentId && scripts[currentId]) {
    const current = scripts[currentId];

    if (current && !state.editorDrafts.drafts[currentId]) {
      listenerApi.dispatch(ensureDraft(current));
    }

    return;
  }

  const restoredId = state.ui.selectedScriptId;
  const targetId =
    restoredId && scripts[restoredId] ? restoredId : scriptIds[0];
  const target = scripts[targetId];

  if (target && !state.editorDrafts.drafts[targetId]) {
    listenerApi.dispatch(ensureDraft(target));
  }

  listenerApi.dispatch(setCurrentUserscript(targetId));
}

listenerMiddleware.startListening({
  predicate: (action, currentState, previousState) => {
    const current = currentState as { ui: UiState };
    const previous = previousState as { ui: UiState };

    return (
      current.ui.hydrated &&
      action.type !== hydrateUi.fulfilled.type &&
      current.ui !== previous.ui &&
      // Hydrate itself writes the loaded snapshot; don't echo it back immediately.
      previous.ui.hydrated
    );
  },
  effect: (_action, listenerApi) => {
    if (uiSaveTimer != null) {
      clearTimeout(uiSaveTimer);
    }

    uiSaveTimer = setTimeout(() => {
      uiSaveTimer = null;
      const state = listenerApi.getState() as { ui: UiState };
      flushUiState(state.ui);
    }, UI_SAVE_DEBOUNCE_MS);
  },
});

// Monaco-side effects (models, package.json libs, ambient/CDN types) are
// handled by the WorkspaceService, which subscribes to this store once.

listenerMiddleware.startListening({
  actionCreator: setCurrentUserscript,
  effect: (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const script = state.userscripts.scripts[action.payload.id];

    if (script && !state.editorDrafts.drafts[script.id]) {
      listenerApi.dispatch(ensureDraft(script));
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: hydrateUi.fulfilled,
  effect: (_action, listenerApi) => {
    restoreSelectedUserscript(listenerApi);
  },
});

listenerMiddleware.startListening({
  actionCreator: loadUserscripts.fulfilled,
  effect: (_action, listenerApi) => {
    restoreSelectedUserscript(listenerApi);
  },
});

listenerMiddleware.startListening({
  actionCreator: resolveConflictTakeRemote,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(syncScriptsFromRemote([action.payload]));
  },
});

listenerMiddleware.startListening({
  actionCreator: resolveAllConflictsTakeRemote,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(syncScriptsFromRemote(action.payload));
  },
});

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
    editorDrafts: editorDraftsReducer,
    modules: modulesReducer,
    settings: settingsReducer,
    editor: editorReducer,
    workspace: workspaceReducer,
    ui: uiReducer,
  },
  devTools: {
    name: "Invert IDE Userscripts",
  },
  middleware: (getDefaultMiddleware) => {
    const defaultMiddleware = getDefaultMiddleware().prepend(
      listenerMiddleware.middleware
    );

    if (!isDevelopment) {
      return defaultMiddleware;
    }

    return defaultMiddleware.concat(
      createLogger({
        collapsed: true,
        diff: true,
      })
    );
  },
});

export function flushPersistedUiState(): void {
  if (uiSaveTimer == null) {
    return;
  }

  clearTimeout(uiSaveTimer);
  uiSaveTimer = null;
  flushUiState(store.getState().ui);
}

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
