import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Userscript, UserscriptCode, Userscripts, UserscriptStatus } from "@shared/model";
import { StorageManager } from "@shared/storage";

export type UserscriptsSliceState = {
  scripts?: Userscripts;
  currentScript?: Userscript;
};

const initialState: UserscriptsSliceState = {
  scripts: {},
  currentScript: undefined,
};

export const loadUserscripts = createAsyncThunk(
  "userscripts/loadUserscripts",
  StorageManager.getScripts
);

const toScriptList = (scriptsRecord: Userscripts): Userscript[] => {
  return Object.values(scriptsRecord);
};

const userscriptsSlice = createSlice({
  name: "userscripts",
  initialState,
  selectors: {
    selectAllUserscripts: (state: UserscriptsSliceState) => toScriptList(state.scripts),
    selectCurrentUserscript: (state: UserscriptsSliceState) => state.currentScript,
    selectUnsavedUserscripts: (state: UserscriptsSliceState) => {
      return new Set(
        toScriptList(state.scripts)
          .filter((script) => script.status === "modified")
          .map((script) => script.id) || []
      );
    },
  },
  reducers: {
    selectUserscript: (state, action: PayloadAction<Userscript>) => {
      state.currentScript = toScriptList(state.scripts).find(
        (script) => script.id === action.payload.id
      );
    },
    addUserscript: (state, action: PayloadAction<Userscript>) => {
      state.scripts[action.payload.id] = action.payload;
      console.log("Added userscript: ", action.payload);
    },
    updateUserscript: (state, action: PayloadAction<Userscript>) => {
      state.scripts[action.payload.id] = action.payload;
    },
    updateUserscriptCode: {
      prepare: (id: string, language: UserscriptCode, code: string) => {
        return {
          payload: {
            id,
            language,
            code,
          },
        };
      },
      reducer: (
        state,
        action: PayloadAction<{ id: string; language: UserscriptCode; code: string }>
      ) => {
        const { id, language, code } = action.payload;

        const script = state.scripts[id];
        script.code[language] = code;
        script.status = "modified";
      },
    },
    deleteUserscript: (
      state,
      action: PayloadAction<{
        id: string;
      }>
    ) => {
      const { id } = action.payload;

      state.scripts = Object.fromEntries(
        Object.entries(state.scripts).filter(([scriptId]) => scriptId !== id)
      );

      if (state.currentScript?.id === id) {
        state.currentScript = undefined;
      }
    },
    setUserscriptStatus: (
      state,
      action: PayloadAction<{ id: string; status: UserscriptStatus }>
    ) => {
      const { id, status } = action.payload;
      const script = state.scripts[id];

      if (script != null) {
        script.status = status;
      }
    },
  },
  // Reducers not tied to specific actions
  extraReducers: (builder) => {
    builder.addAsyncThunk(
      createAsyncThunk("userscripts/loadUserscripts", StorageManager.getScripts),
      {
        fulfilled: (state, action) => {
          state.scripts = action.payload;
        },
        rejected: (_state, action) => {
          console.error("Failed to load userscripts: ", action.error);
        },
      }
    );
  },
});

// Automatically generated action creators for the slice
export const {
  selectUserscript,
  addUserscript,
  updateUserscript,
  updateUserscriptCode,
  deleteUserscript,
  setUserscriptStatus,
} = userscriptsSlice.actions;

// Automatically generated selectors for the slice
export const { selectAllUserscripts, selectCurrentUserscript, selectUnsavedUserscripts } =
  userscriptsSlice.selectors;

// Export the slice reducer as the default export
export default userscriptsSlice.reducer;
