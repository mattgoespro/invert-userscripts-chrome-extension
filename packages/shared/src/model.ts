export interface UserScript {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  code: string;
  urlPatterns: string[];
  runAt: 'document_start' | 'document_end' | 'document_idle';
  createdAt: number;
  updatedAt: number;
}

export interface ScriptFile {
  id: string;
  scriptId: string;
  name: string;
  language: 'typescript' | 'javascript' | 'scss' | 'css';
  content: string;
  isMain: boolean;
}

export interface GlobalModule {
  id: string;
  name: string;
  url: string;
  version?: string;
  enabled: boolean;
}

export interface EditorTheme {
  id: string;
  name: string;
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
}

export interface AppSettings {
  editorTheme: string;
  fontSize: number;
  tabSize: number;
  autoFormat: boolean;
  autoSave: boolean;
  enableTypeChecking: boolean;
}

export interface CompileResult {
  success: boolean;
  code?: string;
  error?: string;
  warnings?: string[];
}
