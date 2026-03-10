import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  createUserscript,
  deleteUserscript,
  loadUserscripts,
  toggleUserscript,
  updateUserscript,
  updateUserscriptCode,
} from "./thunks.userscripts";
import { initialState, UserscriptsState } from "./state.userscripts";

const selectSharedUserscriptsMemo = createSelector(
  (state: UserscriptsState) => state.scripts,
  (scripts) => Object.values(scripts ?? {}).filter((script) => script.shared)
);

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
      });
  },
});

export const { setCurrentUserscript, markUserscriptModified } =
  userscriptsSlice.actions;

export const {
  selectAllUserscripts,
  selectUserscriptById,
  selectCurrentUserscript,
  selectUnsavedUserscripts,
  selectSharedUserscripts,
} = userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
