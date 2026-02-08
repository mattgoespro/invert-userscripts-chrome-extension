export type UserscriptStatus = "modified" | "saved";

export type UserscriptSourceCode = "typescript" | "scss";

export type UserscriptCompiledCode = "javascript" | "css";

export interface Userscript {
  id: string;
  name: string;
  enabled: boolean;
  status: UserscriptStatus;
  error?: boolean;
  code: {
    source: {
      [key in UserscriptSourceCode]: string;
    };
    compiled: {
      [key in UserscriptCompiledCode]: string;
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
  theme: string;
  fontSize: number;
  tabSize: number;
  autoFormat: boolean;
  autoSave: boolean;
}

export interface CompileResult {
  success: boolean;
  code?: string;
  error?: Error;
}
