import {
  findDuplicateModulePathScript,
  type CompiledCodeEntry,
} from "../model";
import type {
  CommitOutcome,
  PreparedMutation,
  RepositorySnapshot,
  SavedDocument,
} from "../publication/contracts";
import type { CausalRevision } from "./sync/replication";
import { mergeSyncRevision } from "./sync/replication";
import type { ApplyScriptsResponse } from "../messages";
export interface PendingRevision {
  id: string;
  revision: string;
  parents: string[];
  script?: SavedDocument["script"];
  conflictReason?: string;
}
export interface RepositoryState extends Omit<RepositorySnapshot, "documents"> {
  cssOutbox: Record<string, string>;
  effects: Record<
    string,
    { status: "started" | "completed"; result?: ApplyScriptsResponse }
  >;
  preferenceOutbox: { modules?: string; settings?: string };
  legacyObserved: Record<string, string>;
  legacyEmitted: Record<string, { id: string; revision: string }>;
  documents: Record<string, SavedDocument>;
  receipts: Record<string, CommitOutcome>;
  tombstones: Record<string, { revision: string; parents: string[] }>;
  outbox: Record<string, PendingRevision>;
  syncRecords: Record<string, CausalRevision>;
  syncHeads: Record<string, string[]>;
  syncConflicts: Record<string, PendingRevision[]>;
}
export function emptyRepositoryState(): RepositoryState {
  return {
    cssOutbox: {},
    effects: {},
    preferenceOutbox: {},
    legacyObserved: {},
    legacyEmitted: {},
    documents: {},
    artifacts: {},
    generation: 0,
    modules: {},
    moduleRevision: null,
    settings: {},
    settingsRevision: null,
    receipts: {},
    tombstones: {},
    outbox: {},
    syncRecords: {},
    syncHeads: {},
    syncConflicts: {},
  };
}
// Internally documents are indexed, snapshots expose a list.
export interface StoredRepositoryState extends Omit<
  RepositoryState,
  "documents"
> {
  documents: Record<string, SavedDocument>;
}
export function createRepositoryState(): StoredRepositoryState {
  return { ...emptyRepositoryState(), documents: {} };
}
export interface MutationResult {
  state: StoredRepositoryState;
  outcome: CommitOutcome;
}
export function applyMutation(
  input: StoredRepositoryState | RepositoryState,
  command: PreparedMutation
): MutationResult {
  const state = input as StoredRepositoryState;
  const receipt = state.receipts[command.requestId];
  if (receipt) {
    return { state, outcome: receipt };
  }
  const conflict =
    command.writes.some(
      (write) =>
        (state.documents[write.id]?.revision ??
          state.tombstones[write.id]?.revision ??
          null) !== write.expectedRevision
    ) ||
    Boolean(
      command.modules &&
      command.modules.expectedRevision !== state.moduleRevision
    ) ||
    Boolean(
      command.settings &&
      command.settings.expectedRevision !== state.settingsRevision
    );
  if (conflict) {
    return {
      state,
      outcome: { status: "conflict", current: Object.values(state.documents) },
    };
  }
  const next: StoredRepositoryState = structuredClone(state);
  // Normalize a fresh empty fixture's documents list.
  if (Array.isArray(next.documents)) {
    next.documents = {};
  }
  const documents: SavedDocument[] = [];
  next.cssOutbox ??= {};
  for (const write of command.writes) {
    const revision = write.migrationRevision ?? crypto.randomUUID();
    // Editing the local branch is not consent to discard an unresolved remote branch.
    const parents = write.expectedRevision ? [write.expectedRevision] : [];
    if (write.deleted) {
      delete next.documents[write.id];
      delete next.artifacts[write.id];
      next.tombstones[write.id] = { revision, parents };
      next.outbox[revision] = { id: write.id, revision, parents };
    } else if (write.script) {
      const script = structuredClone(write.script);
      delete script.storageRevision;
      script.code.compiled = { javascript: "", css: "" };
      const document = { script, revision, parents };
      next.documents[write.id] = document;
      delete next.tombstones[write.id];
      if (write.artifact) {
        next.artifacts[write.id] = write.artifact;
      }
      documents.push(document);
      next.outbox[revision] = { id: write.id, revision, parents, script };
    } else if (write.artifact) {
      if (!next.documents[write.id]) {
        return {
          state,
          outcome: {
            status: "rejected",
            reason: "Artifact source is missing.",
          },
        };
      }
      next.artifacts[write.id] = write.artifact;
    }
    next.cssOutbox[write.id] = command.requestId;
    if (write.script || write.deleted) {
      next.syncRecords[revision] = { revision, parents };
      next.syncHeads[write.id] = mergeSyncRevision(
        next.syncHeads[write.id] ?? [],
        { revision, parents },
        next.syncRecords
      ).heads;
    }
  }
  for (const document of Object.values(next.documents)) {
    const duplicate = findDuplicateModulePathScript(
      Object.values(next.documents).map((item) => item.script),
      document.script
    );
    if (duplicate) {
      return {
        state,
        outcome: {
          status: "rejected",
          reason: "Module path is already used by " + duplicate.name,
        },
      };
    }
  }
  if (command.modules) {
    next.modules = command.modules.value;
    next.moduleRevision = crypto.randomUUID();
    next.preferenceOutbox.modules = next.moduleRevision;
  }
  if (command.settings) {
    next.settings = command.settings.value;
    next.settingsRevision = crypto.randomUUID();
    next.preferenceOutbox.settings = next.settingsRevision;
  }
  next.generation++;
  const outcome: CommitOutcome = {
    status: "committed",
    requestId: command.requestId,
    documents,
    generation: next.generation,
  };
  next.receipts[command.requestId] = outcome;
  return { state: next, outcome };
}
export interface DocumentRepository {
  snapshot(): Promise<RepositorySnapshot>;
  read(id: string): Promise<SavedDocument | null>;
  commit(command: PreparedMutation): Promise<CommitOutcome>;
  readReceipt(requestId: string): Promise<CommitOutcome | null>;
  readArtifacts(): Promise<Record<string, CompiledCodeEntry>>;
}
