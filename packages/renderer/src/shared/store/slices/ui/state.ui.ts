import {
  AppSidebarTab,
  GlobalStateManager,
  GlobalStateSizes,
  ScriptEditorDrawerTab,
  ScriptListSort,
} from "@shared/storage";

export type UiState = {
  scriptListSort: ScriptListSort;
  hydrated: boolean;
  activeSidebarTab: AppSidebarTab;
  selectedScriptId: string | null;
  outputDrawerCollapsed: boolean;
  outputDrawerActiveTab: ScriptEditorDrawerTab;
  panelSizes: Required<GlobalStateSizes>;
};

const defaults = GlobalStateManager.defaultState;

export const initialUiState: UiState = {
  scriptListSort: defaults.scriptListSort ?? "name",
  hydrated: false,
  activeSidebarTab: defaults.activeSidebarTab ?? "scripts",
  selectedScriptId: defaults.selectedScriptId ?? null,
  outputDrawerCollapsed: defaults.outputDrawerCollapsed ?? true,
  outputDrawerActiveTab: defaults.outputDrawerActiveTab ?? "errors",
  panelSizes: {
    scriptListSidebarWidth: defaults.panelSizes.scriptListSidebarWidth ?? 30,
    scriptCodeEditorHorizontalSplit:
      defaults.panelSizes.scriptCodeEditorHorizontalSplit ?? 50,
    scriptTypeDefinitionsVerticalSplit:
      defaults.panelSizes.scriptTypeDefinitionsVerticalSplit ?? 68,
    scriptCompiledOutputDrawerSplit:
      defaults.panelSizes.scriptCompiledOutputDrawerSplit ?? 70,
  },
};
