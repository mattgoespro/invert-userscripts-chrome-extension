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
  globalModules: string[];
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
  packageName?: string;
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
