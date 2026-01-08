import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Userscript } from "@shared/model";
import { StorageManager } from "@shared/storage";

export type UserscriptsState = {
  scripts?: Userscript[];
  selectedScript?: Userscript;
};

// Load persisted state
const initialState: UserscriptsState = {
  scripts: undefined,
};

// --- Async Thunks ---

export const loadUserscripts = createAsyncThunk("userscripts/loadUserscripts", async () => {
  const scriptsMap = await StorageManager.getScripts();
  // Convert Record<string, Userscript> to Userscript[]
  return Object.values(scriptsMap);
});

const userscriptsSlice = createSlice({
  name: "userscripts",
  initialState,
  reducers: {
    selectUserscript(state, action: PayloadAction<Userscript>) {
      state.selectedScript = state.scripts?.find((script) => script.id === action.payload.id);
    },
    addUserscript(state, action: PayloadAction<Userscript>) {
      if (state.scripts == null) {
        state.scripts = [];
      }
      state.scripts.push(action.payload);
      console.log("Added userscript: ", action.payload);
    },
    updateUserscript(state, action: PayloadAction<Userscript>) {
      if (state.scripts == null) {
        return;
      }

      const index = state.scripts.findIndex((script) => script.id === action.payload.id);

      if (index !== -1) {
        state.scripts[index] = action.payload;
      }
      // Also update selectedScript if it matches
      if (state.selectedScript?.id === action.payload.id) {
        state.selectedScript = action.payload;
      }
    },
    deleteUserscript(state, action: PayloadAction<string>) {
      if (state.scripts == null) {
        return;
      }

      state.scripts = state.scripts.filter((script) => script.id !== action.payload);
      if (state.selectedScript?.id === action.payload) {
        state.selectedScript = undefined;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        state.scripts = action.payload;
      });
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const { selectUserscript, addUserscript, updateUserscript, deleteUserscript } =
  userscriptsSlice.actions;

// Export the slice reducer as the default export
export default userscriptsSlice.reducer;
