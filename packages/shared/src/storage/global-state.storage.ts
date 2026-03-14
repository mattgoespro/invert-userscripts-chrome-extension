type SidebarTab = "scripts" | "modules" | "settings";

type OutputDrawerTab = "javascript" | "css";

export interface GlobalStateSizes {
  /**
   * Width percentage of the script list sidebar panel within the scripts page horizontal split.
   * Range: 0–100.
   */
  scriptListSidebarWidth?: number;
  /**
   * Width percentage of the TypeScript editor within the side-by-side source panels.
   * Range: 0–100.
   */
  scriptCodeEditorHorizontalSplit?: number;
  /**
   * Height percentage of the source editors panel within the outer vertical split
   * (source editors vs. compiled output drawer).
   * Range: 0–100.
   */
  scriptCompiledOutputDrawerSplit?: number;
}

export interface GlobalState {
  /**
   * The currently active sidebar navigation tab.
   */
  activeSidebarTab?: SidebarTab;
  /**
   * The ID of the most recently selected userscript, used to restore selection on reload.
   */
  selectedScriptId?: string;
  /**
   * Whether the compiled output drawer is collapsed.
   */
  outputDrawerCollapsed?: boolean;
  /**
   * The active tab displayed inside the compiled output drawer.
   */
  outputDrawerActiveTab?: OutputDrawerTab;
  /**
   * Persisted pixel-percentage sizes for all resizable panel groups.
   */
  panelSizes?: GlobalStateSizes;
}

export class GlobalStateManager {
  private static readonly storageKey = "globalState";

  /**
   * The default UI state used when no persisted state is found. Must be kept in sync with the
   * default value in {@link GlobalStateProvider}.
   */
  static get defaultState(): GlobalState {
    return {
      activeSidebarTab: "scripts",
      selectedScriptId: null,
      outputDrawerCollapsed: false,
      outputDrawerActiveTab: "javascript",
      panelSizes: {
        scriptListSidebarWidth: 30,
        scriptCodeEditorHorizontalSplit: 50,
        scriptCompiledOutputDrawerSplit: 70,
      },
    };
  }

  /**
   * Retrieves the persisted UI state from `chrome.storage.sync`.
   */
  static async get(): Promise<GlobalState> {
    const result = await chrome.storage.sync.get<{ globalState: GlobalState }>([
      this.storageKey,
    ]);
    const stored = result[this.storageKey];

    return {
      ...this.defaultState,
      ...(stored ?? {}),
      panelSizes: {
        ...this.defaultState.panelSizes,
        ...(stored?.panelSizes ?? {}),
      } satisfies GlobalStateSizes,
    };
  }

  /**
   * Overwrites the entire UI state in chrome.storage.sync.
   */
  static async save(state: GlobalState): Promise<void> {
    await chrome.storage.sync.set({ [this.storageKey]: state });
  }
}
