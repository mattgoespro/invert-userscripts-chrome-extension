import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Userscript, UserscriptSourceCode, Userscripts } from "@shared/model";
import { StorageManager } from "@shared/storage";
import { TypeScriptCompiler, SassCompiler } from "@/sandbox/compiler";
import type { RootState } from "../store";

export type UserscriptsState = {
  scripts?: Userscripts;
  currentUserscript?: Userscript;
};

const initialState: UserscriptsState = {
  scripts: {},
};

export const loadUserscripts = createAsyncThunk("userscripts/loadUserscripts", async () => {
  const scriptsMap = await StorageManager.getAllScripts();
  return Object.values(scriptsMap);
});

export const createUserscript = createAsyncThunk(
  "userscripts/createUserscript",
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
    const scriptsMap = await StorageManager.getAllScripts();
    const script = scriptsMap[scriptId];

    if (!script) {
      throw new Error(`Userscript not found: ${scriptId}`);
    }

    const updatedScript: Userscript = {
      ...script,
      enabled: !script.enabled,
    };

    await StorageManager.saveScript(updatedScript);
    return updatedScript;
  }
);

export const updateUserscript = createAsyncThunk<Userscript, Userscript, { state: RootState }>(
  "userscripts/updateUserscript",
  async (script: Userscript) => {
    await StorageManager.updateScript(script.id, script);
    return script;
  }
);

export const updateUserscriptCode = createAsyncThunk(
  "userscripts/updateUserscriptCode",
  async ({ id, language, code }: { id: string; language: UserscriptSourceCode; code: string }) => {
    const scriptsMap = await StorageManager.getAllScripts();
    const script = scriptsMap[id];

    if (language === "typescript") {
      const compiled = TypeScriptCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(`TypeScript compilation error: ${compiled.error?.message}`);
      }

      script.code.source.typescript = code;
      script.code.compiled.javascript = compiled.code ?? "";
    } else if (language === "scss") {
      const compiled = await SassCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(`SCSS compilation error: ${compiled.error?.message}`);
      }

      script.code.source.scss = code;
      script.code.compiled.css = compiled.code ?? "";
    }

    script.updatedAt = Date.now();

    await StorageManager.updateScript(id, script);

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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        state.scripts = Object.fromEntries(action.payload.map((script) => [script.id, script]));
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
      })
      .addCase(updateUserscriptCode.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;
      });
  },
});

export const { setCurrentUserscript } = userscriptsSlice.actions;

export const {
  selectAllUserscripts,
  selectUserscriptById,
  selectCurrentUserscript,
  selectUnsavedUserscripts,
} = userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
