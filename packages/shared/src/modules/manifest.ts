export interface ModuleImport {
  specifier: string;
  runtime: boolean;
  modulePath?: string;
  target?: "main" | "types";
}
export interface ModuleDiagnostic {
  kind: "dynamic-import" | "re-export" | "import-meta" | "unsupported-import";
  message: string;
}
export interface ModuleManifest {
  /** Worker-verified complete async IIFE completion; absent on analysis-only manifests. */
  awaitCompletion?: boolean;
  version: 1;
  source: string;
  imports: ModuleImport[];
  diagnostics: ModuleDiagnostic[];
}
