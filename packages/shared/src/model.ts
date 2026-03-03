import type { EditorThemeName } from "@packages/monaco";

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

export interface SharedScriptInfo {
  id: string;
  name: string;
  moduleName: string;
  sourceCode: string;
}
