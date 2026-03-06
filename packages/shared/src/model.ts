import type { EditorThemeName } from "@packages/monaco";

export type AppThemeName =
  | "graphite"
  | "graphite-warm"
  | "graphite-dusk"
  | "graphite-ember"
  | "obsidian"
  | "obsidian-deep"
  | "obsidian-ember"
  | "obsidian-frost";

export type UserscriptStatus = "modified" | "saved";

export type UserscriptSourceLanguage = "typescript" | "scss";

export type UserscriptCompiledLanguage = "javascript" | "css";

export interface Userscript {
  id: string;
  name: string;
  enabled: boolean;
  status: UserscriptStatus;
  error?: boolean;
  shared: boolean;
  moduleName: string;
  sharedScripts: string[];
  code: {
    source: {
      [key in UserscriptSourceLanguage]: string;
    };
    compiled: {
      [key in UserscriptCompiledLanguage]: string;
    };
  };
  urlPatterns: string[];
  runAt: "beforePageLoad" | "afterPageLoad";
  createdAt: number;
  updatedAt: number;
}

export type Userscripts = Record<string, Userscript>;

export type GlobalModules = Record<string, GlobalModule>;

export interface GlobalModule {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface EditorSettings {
  theme?: EditorThemeName;
  appTheme?: AppThemeName;
  fontSize?: number;
  tabSize?: number;
  autoFormat?: boolean;
  autoSave?: boolean;
}

export interface UserscriptCompileResult {
  success: boolean;
  code?: string;
  error?: Error;
}

/**
 * Compiled code stored separately in Chrome local storage.
 */
export interface CompiledCodeEntry {
  javascript: string;
  css: string;
}

export interface SharedScriptInfo {
  id: string;
  name: string;
  moduleName: string;
  sourceCode: string;
}

export type SidebarTab = "scripts" | "modules" | "settings";

export type OutputDrawerTab = "javascript" | "css";

export interface UIPanelSizes {
  /**
   * Width percentage of the script list sidebar panel within the scripts page horizontal split.
   * Range: 0–100.
   */
  scriptListWidth: number;
  /**
   * Width percentage of the TypeScript editor within the side-by-side source panels.
   * Range: 0–100.
   */
  tsScssHorizontalSplit: number;
  /**
   * Height percentage of the source editors panel within the outer vertical split
   * (source editors vs. compiled output drawer).
   * Range: 0–100.
   */
  sourceVsDrawerSplit: number;
}

export interface UIState {
  /**
   * The currently active sidebar navigation tab.
   */
  activeSidebarTab: SidebarTab;
  /**
   * The ID of the most recently selected userscript, used to restore selection on reload.
   */
  selectedScriptId: string | null;
  /**
   * Whether the compiled output drawer is collapsed.
   */
  outputDrawerCollapsed: boolean;
  /**
   * The active tab displayed inside the compiled output drawer.
   */
  outputDrawerActiveTab: OutputDrawerTab;
  /**
   * Persisted pixel-percentage sizes for all resizable panel groups.
   */
  panelSizes: UIPanelSizes;
}
