import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import editorDraftsReducer from "./slices/editor-drafts";
import {
  applyRemoteScript,
  commitDraftForSave,
  markDraftClean,
  resolveAllConflictsTakeRemote,
  resolveConflictTakeRemote,
  updateDraftBuffer,
} from "./slices/editor-drafts";
import {
  isDraftDirty,
  type EditorDraft,
} from "./slices/editor-drafts/state.editor-drafts";
import { refreshScriptsFromStorage } from "./slices/editor-drafts/thunks.storage-sync";
import editorReducer from "./slices/code-editor";
import modulesReducer from "./slices/modules";
import settingsReducer from "./slices/settings";
import {
  setUserscriptStatusFromDraft,
  syncScriptsFromRemote,
} from "./slices/userscripts";
import userscriptsReducer from "./slices/userscripts";
import workspaceReducer from "./slices/workspace";

const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  }
).process?.env?.NODE_ENV;
const isDevelopment = nodeEnv === undefined || nodeEnv === "development";

const listenerMiddleware = createListenerMiddleware();

function syncModifiedStatus(
  listenerApi: { dispatch: (action: unknown) => void; getState: () => unknown },
  scriptId: string
) {
  const state = listenerApi.getState() as {
    editorDrafts: { drafts: Record<string, EditorDraft | undefined> };
  };
  const draft = state.editorDrafts.drafts[scriptId];

  listenerApi.dispatch(
    setUserscriptStatusFromDraft({
      id: scriptId,
      modified: isDraftDirty(draft),
    })
  );
}

listenerMiddleware.startListening({
  actionCreator: updateDraftBuffer,
  effect: (action, listenerApi) => {
    syncModifiedStatus(listenerApi, action.payload.scriptId);
  },
});

listenerMiddleware.startListening({
  actionCreator: markDraftClean,
  effect: (action, listenerApi) => {
    syncModifiedStatus(listenerApi, action.payload.scriptId);
  },
});

listenerMiddleware.startListening({
  actionCreator: commitDraftForSave,
  effect: (action, listenerApi) => {
    syncModifiedStatus(listenerApi, action.payload.scriptId);
  },
});

// Monaco-side effects (models, package.json libs, ambient/CDN types) are
// handled by the WorkspaceService, which subscribes to this store once.

listenerMiddleware.startListening({
  actionCreator: refreshScriptsFromStorage.fulfilled,
  effect: (action, listenerApi) => {
    if (action.payload.syncedScripts.length > 0) {
      listenerApi.dispatch(syncScriptsFromRemote(action.payload.syncedScripts));
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: applyRemoteScript,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(syncScriptsFromRemote([action.payload]));
    syncModifiedStatus(listenerApi, action.payload.id);
  },
});

listenerMiddleware.startListening({
  actionCreator: resolveConflictTakeRemote,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(syncScriptsFromRemote([action.payload]));
    syncModifiedStatus(listenerApi, action.payload.id);
  },
});

listenerMiddleware.startListening({
  actionCreator: resolveAllConflictsTakeRemote,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(syncScriptsFromRemote(action.payload));
    for (const script of action.payload) {
      syncModifiedStatus(listenerApi, script.id);
    }
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

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
