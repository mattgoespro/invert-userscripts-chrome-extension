import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  initialState as editorDraftsInitialState,
  type EditorDraftsState,
} from "@/shared/store/slices/editor-drafts/state.editor-drafts";
import { initialState as userscriptsInitialState } from "@/shared/store/slices/userscripts/state.userscripts";
import {
  acceptPublishedScript,
  syncScriptsFromRemote,
  removeRemoteScripts,
} from "@/shared/store/slices/userscripts/actions.publication";

/**
 * Popup-only store: load + toggle. Does not register IDE compile/save thunks
 * or editor draft middleware.
 */
const popupUserscriptsSlice = createSlice({
  name: "userscripts",
  initialState: userscriptsInitialState,
  reducers: {},
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
        }
      })
      .addCase(acceptPublishedScript, (state, action) => {
        const { script, kind } = action.payload;
        if (kind === "toggled" && state.scripts[script.id]) {
          state.scripts[script.id].enabled = script.enabled;
        }
      });
  },
});

function editorDraftsStubReducer(
  state: EditorDraftsState = editorDraftsInitialState,
  _action: PayloadAction<unknown>
): EditorDraftsState {
  return state;
}

export const popupStore = configureStore({
  reducer: {
    userscripts: popupUserscriptsSlice.reducer,
    editorDrafts: editorDraftsStubReducer,
  },
  devTools: {
    name: "Invert Popup",
  },
});

export type PopupStore = typeof popupStore;
export type PopupRootState = ReturnType<PopupStore["getState"]>;
export type PopupDispatch = PopupStore["dispatch"];
