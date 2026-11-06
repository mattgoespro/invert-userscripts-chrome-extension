import { transactionalEnabled } from "../publication/client";
import { repositoryRequest } from "../publication/client";
export type AppSidebarTab = "scripts" | "modules" | "settings";

export type ScriptEditorDrawerTab = "javascript" | "css" | "errors";
export type ScriptListSort = "name" | "created";

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
   * Height percentage of the main TypeScript editor within the stacked TypeScript panel
   * (main script editor vs. declaration editor).
   * Range: 0–100.
   */
  scriptTypeDefinitionsVerticalSplit?: number;
  /**
   * Height percentage of the source editors panel within the outer vertical split
   * (source editors vs. compiled output drawer).
   * Range: 0–100.
   */
  scriptCompiledOutputDrawerSplit?: number;
}

export interface GlobalState {
  scriptListSort?: ScriptListSort;
  /**
   * Whether the script list shows the URL pattern caption under each script.
   */
  scriptListCaptions?: boolean;
  /**
   * The currently active sidebar navigation tab.
   */
  activeSidebarTab?: AppSidebarTab;
  /**
   * The ID of the most recently selected userscript, used to restore selection on reload.
   */
  selectedScriptId?: string | null;
  /**
   * Whether the compiled output drawer is collapsed.
   */
  outputDrawerCollapsed?: boolean;
  /**
   * The active tab displayed inside the compiled output drawer.
   */
  outputDrawerActiveTab?: ScriptEditorDrawerTab;
  /**
   * Persisted pixel-percentage sizes for all resizable panel groups.
   */
  panelSizes?: GlobalStateSizes;
}

export const DEFAULT_GLOBAL_STATE: GlobalState = {
  scriptListSort: "name",
  scriptListCaptions: true,
  activeSidebarTab: "scripts",
  selectedScriptId: null,
  outputDrawerCollapsed: false,
  outputDrawerActiveTab: "javascript",
  panelSizes: {
    scriptListSidebarWidth: 30,
    scriptCodeEditorHorizontalSplit: 50,
    scriptTypeDefinitionsVerticalSplit: 68,
    scriptCompiledOutputDrawerSplit: 70,
  },
};

/**
 * Merge a sparse/partial persisted UI state with defaults. Nested `panelSizes`
 * are deep-merged so a partial panelSizes write cannot wipe other panel sizes.
 */
export function mergeGlobalState(stored?: GlobalState | null): GlobalState {
  return {
    ...DEFAULT_GLOBAL_STATE,
    ...(stored ?? {}),
    panelSizes: {
      ...DEFAULT_GLOBAL_STATE.panelSizes,
      ...(stored?.panelSizes ?? {}),
    } satisfies GlobalStateSizes,
  };
}

export class GlobalStateManager {
  private static readonly storageKey = "globalState";
  private static readonly lastLocalKey = "globalState:last";

  /**
   * The default UI state used when no persisted state is found. Must be kept in sync with the
   * Redux `ui` slice initial state.
   */
  static get defaultState(): GlobalState {
    return {
      ...DEFAULT_GLOBAL_STATE,
      panelSizes: { ...DEFAULT_GLOBAL_STATE.panelSizes },
    };
  }

  /**
   * Retrieves the persisted UI state from `chrome.storage.sync`.
   */
  static async get(): Promise<GlobalState> {
    if ((await chrome.storage.local.get("driveSyncEnabled")).driveSyncEnabled) {
      const result = await repositoryRequest<{ layout: GlobalState | null }>({
        type: "publication.drive.layout.read",
      });
      return mergeGlobalState(result.layout);
    }
    if (await transactionalEnabled()) {
      const key = this.localKey();
      const local = await chrome.storage.local.get([key, this.lastLocalKey]);
      if (local[key]) {
        return mergeGlobalState(local[key]);
      }
      // A new tab session: earlier tabs' keys are no longer needed to restore layout.
      await this.removeOtherSessionKeys(key).catch(console.error);
      const stored =
        local[this.lastLocalKey] ??
        (await chrome.storage.sync.get(this.storageKey))[this.storageKey];
      const state = mergeGlobalState(stored);
      await chrome.storage.local.set({ [key]: state });
      return state;
    }
    const result = await chrome.storage.sync.get<{ globalState: GlobalState }>([
      this.storageKey,
    ]);
    const stored = result[this.storageKey];

    return mergeGlobalState(stored);
  }

  /**
   * Overwrites the entire UI state in chrome.storage.sync.
   */
  static async save(state: GlobalState): Promise<void> {
    if ((await chrome.storage.local.get("driveSyncEnabled")).driveSyncEnabled) {
      await repositoryRequest({
        type: "publication.drive.layout.write",
        value: state,
      });
      return;
    }
    if (await transactionalEnabled()) {
      await chrome.storage.local.set({
        [this.localKey()]: state,
        [this.lastLocalKey]: state,
      });
      return;
    }
    await chrome.storage.sync.set({ [this.storageKey]: state });
  }
  /**
   * Session keys have no owner liveness or age, so they are removed whenever a tab
   * session starts. A live tab recreates its key on its next save, and until then a
   * reload restores `globalState:last`.
   */
  private static async removeOtherSessionKeys(key: string): Promise<void> {
    const stale = Object.keys(await chrome.storage.local.get(null)).filter(
      (name) =>
        name.startsWith(this.storageKey + ":") &&
        name !== key &&
        name !== this.lastLocalKey
    );
    if (stale.length) {
      await chrome.storage.local.remove(stale);
    }
  }
  private static localKey(): string {
    if (typeof sessionStorage === "undefined") {
      return "globalState";
    }
    let id = sessionStorage.getItem("invert-layout-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("invert-layout-session", id);
    }
    return "globalState:" + id;
  }
}
