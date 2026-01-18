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

export const addUserscript = createAsyncThunk(
  "userscripts/addUserscript",
  async (script: Userscript) => {
    await StorageManager.saveScript(script);
    console.log("Saved new userscript to storage:", script.id);
    return script;
  }
);

export const deleteUserscript = createAsyncThunk(
  "userscripts/deleteUserscript",
  async (scriptId: string) => {
    await StorageManager.deleteScript(scriptId);
    console.log("Deleted userscript from storage:", scriptId);
    return scriptId;
  }
);

export const toggleUserscript = createAsyncThunk(
  "userscripts/toggleUserscript",
  async (scriptId: string) => {
    const scriptsMap = await StorageManager.getScripts();
    const script = scriptsMap[scriptId];

    if (!script) {
      throw new Error(`Userscript not found: ${scriptId}`);
    }

    const updatedScript: Userscript = {
      ...script,
      enabled: !script.enabled,
      updatedAt: Date.now(),
    };

    await StorageManager.saveScript(updatedScript);
    console.log("Toggled userscript in storage:", scriptId, "enabled:", updatedScript.enabled);
    return updatedScript;
  }
);

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
    selectUserscriptById(state: UserscriptsState, scriptId: string) {
      return state.scripts[scriptId];
    },
    selectUnsavedUserscripts(state: UserscriptsState) {
      return Object.values(state.scripts ?? {}).filter((script) => script.status === "modified");
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
    updateUserscript: {
      prepare(id: string, updates: Partial<Omit<Userscript, "id">>) {
        return { payload: { id, ...updates } };
      },
      reducer(state, action: PayloadAction<{ id: string } & Partial<Omit<Userscript, "id">>>) {
        state.scripts[action.payload.id] = {
          ...state.scripts[action.payload.id],
          ...action.payload,
        };
        console.log("Userscript updated.");
      },
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        state.scripts = Object.fromEntries(action.payload.map((script) => [script.id, script]));
      })
      .addCase(addUserscript.fulfilled, (state, action) => {
        state.scripts[action.payload.id] = action.payload;
        console.log("Added userscript to Redux state:", action.payload.id);
      })
      .addCase(deleteUserscript.fulfilled, (state, action) => {
        const scriptId = action.payload;
        state.scripts = Object.fromEntries(
          Object.entries(state.scripts).filter(([id]) => id !== scriptId)
        );

        if (state.currentUserscript?.id === scriptId) {
          state.currentUserscript = undefined;
        }
        console.log("Deleted userscript from Redux state:", scriptId);
      })
      .addCase(toggleUserscript.fulfilled, (state, action) => {
        const updatedScript = action.payload;
        state.scripts[updatedScript.id] = updatedScript;
        console.log("Toggled userscript in Redux state:", updatedScript.id);
      });
  },
});

export const { setCurrentUserscript, updateUserscript } = userscriptsSlice.actions;

export const {
  selectAllUserscripts,
  selectUserscriptById,
  selectCurrentUserscript,
  selectUnsavedUserscripts,
} = userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
