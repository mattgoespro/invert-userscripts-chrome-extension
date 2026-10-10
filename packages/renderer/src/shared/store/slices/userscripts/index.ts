import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  acceptPublishedScript,
  acceptDeletedScript,
  syncScriptsFromRemote,
  removeRemoteScripts,
} from "./actions.publication";
import { acceptRebuiltArtifact } from "./thunks.compile";
import { isUserscriptCompileSnapshotStale } from "@shared/compile-metadata";
import { initialState } from "./state.userscripts";

export {
  selectAllUserscripts,
  selectCurrentUserscript,
  selectSharedUserscripts,
} from "./selectors";

const userscriptsSlice = createSlice({
  name: "userscripts",
  initialState,
  reducers: {
    setCurrentUserscript: {
      prepare: (id: string) => {
        return {
          payload: { id },
        };
      },
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        state.currentScriptId = action.payload.id;
      },
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncScriptsFromRemote, (state, action) => {
        for (const script of action.payload) {
          state.scripts[script.id] = script;
        }
      })
      .addCase(removeRemoteScripts, (state, action) => {
        for (const id of action.payload) {
          delete state.scripts[id];
          if (state.currentScriptId === id) {
            state.currentScriptId = null;
          }
        }
      })
      .addCase(acceptPublishedScript, (state, action) => {
        const { script, kind } = action.payload;
        if (
          kind === "created" ||
          kind === "imported" ||
          state.scripts[script.id]
        ) {
          if (kind === "toggled" && state.scripts[script.id]) {
            state.scripts[script.id].enabled = script.enabled;
          } else {
            state.scripts[script.id] = script;
          }
        }
        if (kind === "created") {
          state.currentScriptId = script.id;
        }
      })
      .addCase(acceptDeletedScript, (state, action) => {
        delete state.scripts[action.payload];
        if (state.currentScriptId === action.payload) {
          state.currentScriptId = null;
        }
      })
      .addCase(acceptRebuiltArtifact, (state, action) => {
        const script = action.payload;
        const existing = state.scripts[script.id];
        if (isUserscriptCompileSnapshotStale(script, existing)) {
          return;
        }
        existing.code.compiled = script.code.compiled;
        existing.sharedScripts = script.sharedScripts;
      });
  },
});

export const { setCurrentUserscript } = userscriptsSlice.actions;

export default userscriptsSlice.reducer;

export {
  syncScriptsFromRemote,
  removeRemoteScripts,
} from "./actions.publication";
