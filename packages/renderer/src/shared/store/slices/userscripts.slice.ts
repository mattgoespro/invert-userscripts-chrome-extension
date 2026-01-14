import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Userscript, UserscriptCode, Userscripts } from "@shared/model";
import { StorageManager } from "@shared/storage";
import { TypeScriptCompiler } from "@shared/compiler";

export type UserscriptsState = {
  scripts?: Userscripts;
  currentUserscript?: Userscript;
};

const initialState: UserscriptsState = {
  scripts: {},
};

export const loadUserscripts = createAsyncThunk("userscripts/loadUserscripts", async () => {
  const scriptsMap = await StorageManager.getScripts();
  return Object.values(scriptsMap);
});

export const updateUserscriptCode = createAsyncThunk(
  "userscripts/updateUserscriptCode",
  async ({ id, language, code }: { id: string; language: UserscriptCode; code: string }) => {
    const scriptsMap = await StorageManager.getScripts();
    const script = scriptsMap[id];

    if (language === "typescript") {
      const compiled = TypeScriptCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(`TypeScript compilation error: ${compiled.error?.message}`);
      }

      console.log("Compiled userscript to JavaScript: ", compiled);

      script.code.typescript = code;
      script.status = "modified";
      script.updatedAt = Date.now();
    } else if (language === "scss") {
      script.code.scss = code;
      script.status = "modified";
      script.updatedAt = Date.now();
    }

    await StorageManager.saveScript(script);
    return script;
  }
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
    selectUnsavedUserscripts(state: UserscriptsState) {
      return Object.values(state.scripts ?? {}).filter((script) => script.status === "modified");
    },
  },
  reducers: {
    selectUserscript(state, action: PayloadAction<Userscript>) {
      state.currentUserscript = state.scripts[action.payload.id];
    },
    addUserscript(state, action: PayloadAction<Userscript>) {
      state.scripts[action.payload.id] = action.payload;
      console.log("Added userscript: ", action.payload);
    },
    updateUserscript(state, action: PayloadAction<Userscript>) {
      state.scripts[action.payload.id] = {
        ...state.scripts[action.payload.id],
        ...action.payload,
      };
      console.log("Userscript updated.");
    },
    deleteUserscript(state, action: PayloadAction<string>) {
      state.scripts = Object.fromEntries(
        Object.entries(state.scripts).filter(([id]) => id !== action.payload)
      );

      if (state.currentUserscript?.id === action.payload) {
        state.currentUserscript = undefined;
      }
    },
    toggleUserscript(state, action: PayloadAction<string>) {
      const script = state.scripts[action.payload];
      script.enabled = !script.enabled;
      state.scripts[action.payload] = script;
    },
  },
  extraReducers: (builder) => {
    builder
      // Additional reducers for async thunks
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        state.scripts = {
          ...Object.fromEntries(action.payload.map((script) => [script.id, script])),
        };
      });
  },
});

export const {
  selectUserscript,
  addUserscript,
  updateUserscript,
  deleteUserscript,
  toggleUserscript,
} = userscriptsSlice.actions;

export const { selectAllUserscripts, selectCurrentUserscript, selectUnsavedUserscripts } =
  userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
