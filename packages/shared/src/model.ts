export interface Userscript {
  id: string;
  name: string;
  enabled: boolean;
  code: string;
  urlPatterns: string[];
  runAt: "document_start" | "document_end" | "document_idle";
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

export interface EditorTheme {
  id: string;
  name: string;
  theme: "vs-dark" | "vs-light" | "hc-black";
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
