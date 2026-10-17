import type {
  CompiledCodeEntry,
  EditorSettings,
  GlobalModules,
  Userscript,
} from "../model";
export type Revision = string;
export type ScriptBuffer = "typescript" | "scss" | "typeDefinitions";
export interface SourceBuffers {
  typescript: string;
  scss: string;
  typeDefinitions: string;
}
export interface SavedDocument {
  revision: Revision;
  script: Userscript;
  parents: Revision[];
}
export interface BuildSnapshot {
  scriptId: string;
  expectedRevision: Revision | null;
  buffers: SourceBuffers;
  shared: boolean;
  modulePath: string;
  minifyCompiledOutput: boolean;
  compilerContractVersion: number;
}
export interface ApplyOutcome {
  status: "not-requested" | "applied" | "partial" | "blocked" | "unknown";
  appliedTabCount: number;
  removedTabCount: number;
  staleSkipCount: number;
  message?: string;
}
export interface DocumentWrite {
  /** Reserved for the internal legacy migration, never accepted over messaging. */
  migrationRevision?: string;
  id: string;
  expectedRevision: Revision | null;
  script?: Userscript;
  artifact?: CompiledCodeEntry;
  deleted?: boolean;
}
export interface PreparedMutation {
  requestId: string;
  writes: DocumentWrite[];
  modules?: { expectedRevision: Revision | null; value: GlobalModules };
  settings?: { expectedRevision: Revision | null; value: EditorSettings };
}
export type CommitOutcome =
  | {
      status: "committed";
      requestId: string;
      documents: SavedDocument[];
      generation: number;
    }
  | { status: "conflict"; current: SavedDocument[] }
  | { status: "rejected"; reason: string };
export interface RepositorySnapshot {
  documents: SavedDocument[];
  artifacts: Record<string, CompiledCodeEntry>;
  generation: number;
  modules: GlobalModules;
  moduleRevision: Revision | null;
  settings: EditorSettings;
  settingsRevision: Revision | null;
}
