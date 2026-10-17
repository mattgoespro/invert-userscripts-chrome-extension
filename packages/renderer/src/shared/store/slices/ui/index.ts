import { createSlice, PayloadAction, type Dispatch } from "@reduxjs/toolkit";
import {
  AppSidebarTab,
  GlobalState,
  GlobalStateSizes,
  ScriptEditorDrawerTab,
  ScriptListSort,
} from "@shared/storage";
import { setCurrentUserscript } from "../userscripts";
import { createUserscript } from "../userscripts/thunks.userscripts";
import { initialUiState, UiState } from "./state.ui";
import { hydrateUi } from "./thunks.ui";

const uiSlice = createSlice({
  name: "ui",
  initialState: initialUiState,
  reducers: {
    setScriptListSort: (state, action: PayloadAction<ScriptListSort>) => {
      state.scriptListSort = action.payload;
    },
    setActiveSidebarTab: (state, action: PayloadAction<AppSidebarTab>) => {
      state.activeSidebarTab = action.payload;
    },
    setOutputDrawerCollapsed: (state, action: PayloadAction<boolean>) => {
      state.outputDrawerCollapsed = action.payload;
    },
    setOutputDrawerActiveTab: (
      state,
      action: PayloadAction<ScriptEditorDrawerTab>
    ) => {
      state.outputDrawerActiveTab = action.payload;
    },
    updatePanelSizes: (
      state,
      action: PayloadAction<Partial<GlobalStateSizes>>
    ) => {
      for (const key of Object.keys(action.payload) as Array<
        keyof GlobalStateSizes
      >) {
        const value = action.payload[key];
        if (value !== undefined) {
          state.panelSizes[key] = value;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateUi.fulfilled, (state, action) => {
        const stored = action.payload;
        state.hydrated = true;
        state.scriptListSort =
          stored.scriptListSort === "created" ? "created" : "name";
        state.activeSidebarTab =
          stored.activeSidebarTab ?? state.activeSidebarTab;
        state.selectedScriptId =
          stored.selectedScriptId ?? state.selectedScriptId;
        state.outputDrawerCollapsed =
          stored.outputDrawerCollapsed ?? state.outputDrawerCollapsed;
        state.outputDrawerActiveTab =
          stored.outputDrawerActiveTab ?? state.outputDrawerActiveTab;
        state.panelSizes = {
          ...state.panelSizes,
          ...(stored.panelSizes ?? {}),
        };
      })
      .addCase(setCurrentUserscript, (state, action) => {
        state.selectedScriptId = action.payload.id;
      })
      .addCase(createUserscript.fulfilled, (state, action) => {
        state.selectedScriptId = action.payload.id;
        state.activeSidebarTab = "scripts";
      });
  },
});

export const {
  setScriptListSort,
  setActiveSidebarTab,
  setOutputDrawerCollapsed,
  setOutputDrawerActiveTab,
  updatePanelSizes,
} = uiSlice.actions;

export function updatePanelSizesIfChanged(
  sizes: Partial<GlobalStateSizes>
): (dispatch: Dispatch, getState: () => { ui: UiState }) => void {
  return (dispatch: Dispatch, getState: () => { ui: UiState }): void => {
    const current = getState().ui.panelSizes;
    if (
      (Object.keys(sizes) as Array<keyof GlobalStateSizes>).some(
        (key) => sizes[key] !== undefined && sizes[key] !== current[key]
      )
    ) {
      dispatch(updatePanelSizes(sizes));
    }
  };
}

export const selectUiHydrated = (state: { ui: UiState }) => state.ui.hydrated;
export const selectActiveSidebarTab = (state: { ui: UiState }) =>
  state.ui.activeSidebarTab;
export const selectOutputDrawerCollapsed = (state: { ui: UiState }) =>
  state.ui.outputDrawerCollapsed;
export const selectOutputDrawerActiveTab = (state: { ui: UiState }) =>
  state.ui.outputDrawerActiveTab;
export const selectPanelSizes = (state: { ui: UiState }) => state.ui.panelSizes;
export const selectScriptListSort = (state: { ui: UiState }) =>
  state.ui.scriptListSort;

export function toPersistedGlobalState(ui: UiState): GlobalState {
  return {
    scriptListSort: ui.scriptListSort,
    activeSidebarTab: ui.activeSidebarTab,
    selectedScriptId: ui.selectedScriptId,
    outputDrawerCollapsed: ui.outputDrawerCollapsed,
    outputDrawerActiveTab: ui.outputDrawerActiveTab,
    panelSizes: { ...ui.panelSizes },
  };
}

export { hydrateUi } from "./thunks.ui";
export type { UiState };

export default uiSlice.reducer;
