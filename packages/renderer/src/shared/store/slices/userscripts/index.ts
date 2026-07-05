import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Userscript } from "@shared/model";
import { isDraftDirty } from "../editor-drafts/state.editor-drafts";
import type { RootState } from "../../store";
import {
  createUserscript,
  deleteUserscript,
  importUserscripts,
  loadUserscripts,
  rebuildCompiledUserscripts,
  toggleUserscript,
  updateUserscript,
  updateUserscriptCode,
  updateUserscriptTypeDefinitions,
} from "./thunks.userscripts";
import { initialState, UserscriptsState } from "./state.userscripts";

const selectSharedUserscriptsMemo = createSelector(
  (state: UserscriptsState) => state.scripts,
  (scripts) => Object.values(scripts ?? {}).filter((script) => script.shared)
);

function syncScriptStatusFromDraft(
  state: UserscriptsState,
  scriptId: string,
  draftDirty: boolean
) {
  const script = state.scripts[scriptId];

  if (!script) {
    return;
  }

  const nextStatus = draftDirty ? "modified" : "saved";

  if (script.status !== nextStatus) {
    script.status = nextStatus;

    if (state.currentUserscript?.id === scriptId) {
      state.currentUserscript.status = nextStatus;
    }
  }
}

const userscriptsSlice = createSlice({
  name: "userscripts",
  initialState,
  selectors: {
    selectAllUserscripts(state: UserscriptsState) {
      return state.scripts;
    },
    selectCurrentUserscript(state: UserscriptsState) {
      return state.currentUserscript;
    },
    selectUserscriptById(state: UserscriptsState, scriptId: string) {
      return state.scripts[scriptId];
    },
    selectUnsavedUserscripts(state: UserscriptsState) {
      return Object.values(state.scripts ?? {}).filter(
        (script) => script.status === "modified"
      );
    },
    selectSharedUserscripts(state: UserscriptsState) {
      return selectSharedUserscriptsMemo(state);
    },
  },
  reducers: {
    setCurrentUserscript: {
      prepare: (id: string) => {
        return {
          payload: { id },
        };
      },
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        state.currentUserscript = state.scripts[action.payload.id];
      },
    },
    markUserscriptModified: {
      prepare: (id: string) => {
        return {
          payload: { id },
        };
      },
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        const script = state.scripts[action.payload.id];
        if (script && script.status !== "modified") {
          script.status = "modified";
          if (state.currentUserscript?.id === action.payload.id) {
            state.currentUserscript.status = "modified";
          }
        }
      },
    },
    setUserscriptStatusFromDraft: (
      state,
      action: PayloadAction<{ id: string; modified: boolean }>
    ) => {
      const script = state.scripts[action.payload.id];

      if (!script) {
        return;
      }

      script.status = action.payload.modified ? "modified" : "saved";

      if (state.currentUserscript?.id === action.payload.id) {
        state.currentUserscript.status = script.status;
      }
    },
    syncScriptsFromRemote: (state, action: PayloadAction<Userscript[]>) => {
      for (const script of action.payload) {
        state.scripts[script.id] = script;

        if (state.currentUserscript?.id === script.id) {
          state.currentUserscript = script;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        state.scripts = Object.fromEntries(
          action.payload.map((script) => [script.id, script])
        );
      })
      .addCase(createUserscript.fulfilled, (state, action) => {
        state.scripts[action.payload.id] = action.payload;
      })
      .addCase(deleteUserscript.fulfilled, (state, action) => {
        const id = action.payload;

        state.scripts = Object.fromEntries(
          Object.entries(state.scripts).filter(([scriptId]) => scriptId !== id)
        );

        if (state.currentUserscript?.id === id) {
          state.currentUserscript = undefined;
        }
      })
      .addCase(toggleUserscript.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;
      })
      .addCase(updateUserscript.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;

        if (state.currentUserscript?.id === updatedScript.id) {
          state.currentUserscript = updatedScript;
        }
      })
      .addCase(updateUserscriptCode.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;

        if (state.currentUserscript?.id === updatedScript.id) {
          state.currentUserscript = updatedScript;
        }

        syncScriptStatusFromDraft(state, updatedScript.id, false);
      })
      .addCase(updateUserscriptTypeDefinitions.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;

        if (state.currentUserscript?.id === updatedScript.id) {
          state.currentUserscript = updatedScript;
        }

        syncScriptStatusFromDraft(state, updatedScript.id, false);
      })
      .addCase(rebuildCompiledUserscripts.fulfilled, (state, action) => {
        for (const script of action.payload) {
          state.scripts[script.id] = script;

          if (state.currentUserscript?.id === script.id) {
            state.currentUserscript = script;
          }
        }
      })
      .addCase(importUserscripts.fulfilled, (state, action) => {
        for (const script of action.payload) {
          state.scripts[script.id] = script;
        }
      });
  },
});

export const {
  setCurrentUserscript,
  markUserscriptModified,
  setUserscriptStatusFromDraft,
  syncScriptsFromRemote,
} = userscriptsSlice.actions;

export const selectUnsavedUserscripts = (state: RootState) =>
  Object.values(state.userscripts.scripts ?? {}).filter((script) =>
    isDraftDirty(state.editorDrafts.drafts[script.id])
  );

export const {
  selectAllUserscripts,
  selectUserscriptById,
  selectCurrentUserscript,
  selectSharedUserscripts,
} = userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
