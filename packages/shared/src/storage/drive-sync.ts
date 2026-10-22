import type { EditorSettings, GlobalModules, Userscript } from "../model";
import { findDuplicateModulePathScript } from "../model";
import {
  isEditorSettings,
  isGlobalModules,
  isStoredScript,
} from "../publication/protocol";
import type { PreparedMutation } from "../publication/contracts";
import type { StoredRepositoryState } from "./document-repository";
import type { GlobalState } from "./global-state.storage";
import { mergeSyncRevision } from "./sync/replication";

export type DrivePreference = "settings" | "modules" | "layout";
interface RevisionRecord {
  revision: string;
  parents: string[];
}
export type DriveRecord =
  | (RevisionRecord & { kind: "script"; id: string; script?: Userscript })
  | (RevisionRecord & { kind: "settings"; value: EditorSettings })
  | (RevisionRecord & { kind: "modules"; value: GlobalModules })
  | (RevisionRecord & { kind: "layout"; value: GlobalState });
export interface DriveState {
  paused?: boolean;
  authorizationRequired?: boolean;
  accountId?: string;
  accountLabel?: string;
  adoptionRequired?: boolean;
  records: Record<string, DriveRecord>;
  pending: string[];
  heads: Partial<Record<DrivePreference, string[]>>;
  layout?: GlobalState;
  layoutRevision?: string;
  upload?: { fileId: string; revisions: string[] };
  downloaded?: string[];
  restoredAt?: number;
  syncedAt?: number;
}
export type DrivePhase =
  | "disconnected"
  | "setup-required"
  | "connect-required"
  | "reconnect-required"
  | "account-mismatch"
  | "restoring"
  | "syncing"
  | "offline"
  | "pending"
  | "conflict"
  | "synced"
  | "error";
export interface DriveStatus {
  connected: boolean;
  phase: DrivePhase;
  message: string;
  pending: number;
  accountLabel?: string;
  lastSyncedAt?: number;
  conflicts: Partial<Record<DrivePreference, DriveRecord[]>>;
  current: Partial<Record<DrivePreference, string>>;
  generation: number;
}
const safeRevision = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[\w:-]{1,180}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
export function isDriveLayout(value: unknown): value is GlobalState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return entries.every(([key, item]) => {
    switch (key) {
      case "scriptListSort":
        return ["name", "created"].includes(item);
      case "activeSidebarTab":
        return ["scripts", "modules", "settings"].includes(item);
      case "selectedScriptId":
        return item === null || typeof item === "string";
      case "outputDrawerCollapsed":
        return typeof item === "boolean";
      case "outputDrawerActiveTab":
        return ["javascript", "css", "errors"].includes(item);
      case "panelSizes":
        return (
          !!item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Object.entries(item).every(
            ([name, size]) =>
              [
                "scriptListSidebarWidth",
                "scriptCodeEditorHorizontalSplit",
                "scriptTypeDefinitionsVerticalSplit",
                "scriptCompiledOutputDrawerSplit",
              ].includes(name) &&
              typeof size === "number" &&
              Number.isFinite(size) &&
              size >= 0 &&
              size <= 100
          )
        );
      default:
        return false;
    }
  });
}
export function isDriveRecord(value: unknown): value is DriveRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    !safeRevision(record.revision) ||
    !Array.isArray(record.parents) ||
    !record.parents.every(safeRevision) ||
    record.parents.includes(record.revision)
  ) {
    return false;
  }
  switch (record.kind) {
    case "script":
      return (
        typeof record.id === "string" &&
        record.id.length > 0 &&
        !["__proto__", "constructor", "prototype"].includes(record.id) &&
        (record.script === undefined ||
          isStoredScript(record.script, record.id))
      );
    case "settings":
      return isEditorSettings(record.value);
    case "modules":
      return isGlobalModules(record.value);
    case "layout":
      return isDriveLayout(record.value);
    default:
      return false;
  }
}
function remember(
  state: StoredRepositoryState,
  record: DriveRecord,
  pending: boolean
): void {
  const drive = state.drive!;
  const existing = drive.records[record.revision];
  if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
    throw new Error(
      "Drive revision identity does not match its stored content."
    );
  }
  drive.records[record.revision] = structuredClone(record);
  if (pending && !drive.pending.includes(record.revision)) {
    drive.pending.push(record.revision);
  }
}
export function enableDriveState(
  state: StoredRepositoryState,
  options: { settings?: boolean; modules?: boolean; layout?: GlobalState } = {}
): void {
  if (state.drive) {
    return;
  }
  state.drive = { records: {}, pending: [], heads: {} };
  for (const document of Object.values(state.documents)) {
    captureDriveScript(state, document.script.id);
  }
  for (const id of Object.keys(state.tombstones)) {
    captureDriveScript(state, id);
  }
  for (const entries of Object.values(state.syncConflicts)) {
    for (const entry of entries) {
      remember(
        state,
        {
          kind: "script",
          id: entry.id,
          revision: entry.revision,
          parents: entry.parents,
          ...(entry.script ? { script: entry.script } : {}),
        },
        true
      );
    }
  }
  if (options.settings && state.settingsRevision) {
    remember(
      state,
      {
        kind: "settings",
        revision: state.settingsRevision,
        parents: [],
        value: state.settings,
      },
      true
    );
    state.drive.heads.settings = [state.settingsRevision];
  }
  if (options.modules && state.moduleRevision) {
    remember(
      state,
      {
        kind: "modules",
        revision: state.moduleRevision,
        parents: [],
        value: state.modules,
      },
      true
    );
    state.drive.heads.modules = [state.moduleRevision];
  }
  if (options.layout) {
    setDriveLayout(state, options.layout);
  }
}
export function captureDriveScript(
  state: StoredRepositoryState,
  id: string
): void {
  if (!state.drive) {
    return;
  }
  const document = state.documents[id];
  const record = document ?? state.tombstones[id];
  if (record) {
    remember(
      state,
      {
        kind: "script",
        id,
        revision: record.revision,
        parents: record.parents,
        ...(document ? { script: document.script } : {}),
      },
      true
    );
  }
}
export function captureDriveMutation(
  previous: StoredRepositoryState,
  next: StoredRepositoryState,
  command: PreparedMutation
): void {
  if (!next.drive) {
    return;
  }
  for (const write of command.writes) {
    if (write.script || write.deleted) {
      captureDriveScript(next, write.id);
    }
  }
  if (command.settings) {
    remember(
      next,
      {
        kind: "settings",
        revision: next.settingsRevision!,
        parents: previous.settingsRevision ? [previous.settingsRevision] : [],
        value: next.settings,
      },
      true
    );
    next.drive.heads.settings = mergeSyncRevision(
      next.drive.heads.settings ?? [],
      next.drive.records[next.settingsRevision!],
      next.drive.records
    ).heads;
  }
  if (command.modules) {
    remember(
      next,
      {
        kind: "modules",
        revision: next.moduleRevision!,
        parents: previous.moduleRevision ? [previous.moduleRevision] : [],
        value: next.modules,
      },
      true
    );
    next.drive.heads.modules = mergeSyncRevision(
      next.drive.heads.modules ?? [],
      next.drive.records[next.moduleRevision!],
      next.drive.records
    ).heads;
  }
}
export function setDriveLayout(
  state: StoredRepositoryState,
  layout: GlobalState
): boolean {
  if (!isDriveLayout(layout)) {
    throw new Error("Invalid UI layout.");
  }
  if (!state.drive) {
    throw new Error("Drive storage is not initialized.");
  }
  if (JSON.stringify(state.drive.layout) === JSON.stringify(layout)) {
    return false;
  }
  const record: DriveRecord = {
    kind: "layout",
    revision: crypto.randomUUID(),
    parents: state.drive.layoutRevision ? [state.drive.layoutRevision] : [],
    value: structuredClone(layout),
  };
  remember(state, record, true);
  state.drive.heads.layout = mergeSyncRevision(
    state.drive.heads.layout ?? [],
    record,
    state.drive.records
  ).heads;
  state.drive.layout = structuredClone(layout);
  state.drive.layoutRevision = record.revision;
  state.generation++;
  return true;
}
export function mergeDriveRecords(
  state: StoredRepositoryState,
  incoming: DriveRecord[]
): boolean {
  if (!state.drive) {
    throw new Error("Drive storage is not initialized.");
  }
  // Validate the entire batch before changing even one authoritative value.
  const seen = new Map<string, DriveRecord>();
  for (const record of incoming) {
    if (!isDriveRecord(record)) {
      throw new Error("Invalid Drive revision data.");
    }
    const previous =
      seen.get(record.revision) ?? state.drive.records[record.revision];
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new Error(
        "Drive revision identity does not match its stored content."
      );
    }
    seen.set(record.revision, record);
  }
  const graph = { ...state.drive.records, ...Object.fromEntries(seen) };
  const entity = (record: DriveRecord): string =>
    record.kind === "script" ? "script:" + record.id : record.kind;
  const visited = new Set<string>();
  const active = new Set<string>();
  for (const record of seen.values()) {
    const stack: Array<{ revision: string; exit: boolean }> = [
      { revision: record.revision, exit: false },
    ];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.exit) {
        active.delete(node.revision);
        visited.add(node.revision);
        continue;
      }
      if (active.has(node.revision)) {
        throw new Error("Invalid cyclic Drive revision ancestry.");
      }
      if (visited.has(node.revision) || !graph[node.revision]) {
        continue;
      }
      active.add(node.revision);
      stack.push({ ...node, exit: true });
      const current = graph[node.revision];
      for (const parent of current.parents) {
        if (graph[parent] && entity(graph[parent]) !== entity(current)) {
          throw new Error("Invalid cross-entity Drive revision ancestry.");
        }
        stack.push({ revision: parent, exit: false });
      }
    }
  }
  const before = JSON.stringify([
    state.documents,
    state.tombstones,
    state.settings,
    state.modules,
    state.drive.layout,
    state.syncConflicts,
    state.drive.heads,
  ]);
  for (const record of incoming) {
    remember(state, record, false);
  }
  const scripts = Object.values(state.drive.records).filter(
    (record): record is Extract<DriveRecord, { kind: "script" }> =>
      record.kind === "script"
  );
  for (const record of scripts) {
    state.syncRecords[record.revision] = {
      revision: record.revision,
      parents: record.parents,
    };
  }
  const selections = new Map<
    string,
    {
      heads: string[];
      candidates: Extract<DriveRecord, { kind: "script" }>[];
      selected?: Extract<DriveRecord, { kind: "script" }>;
    }
  >();
  const planned = Object.fromEntries(
    Object.entries(state.documents).map(([id, document]) => [
      id,
      document.script,
    ])
  );
  for (const id of new Set(scripts.map((record) => record.id))) {
    const records = scripts.filter((record) => record.id === id);
    let heads: string[] = [];
    const local = state.documents[id];
    const tombstone = state.tombstones[id];
    if (local || tombstone) {
      heads = [(local ?? tombstone).revision];
    }
    for (const record of records) {
      heads = mergeSyncRevision(heads, record, state.syncRecords).heads;
    }
    state.syncHeads[id] = heads;
    const candidates = records.filter((record) =>
      heads.includes(record.revision)
    );
    const selected =
      candidates.length === 1 && heads.length === 1 ? candidates[0] : undefined;
    selections.set(id, { heads, candidates, selected });
    if (selected?.script) {
      planned[id] = selected.script;
    } else if (selected) {
      delete planned[id];
    }
  }
  // Check the proposed final set, so valid swaps and delete/rename batches work.
  // Holding a colliding candidate can expose another collision; reach a fixed point.
  const collisions = new Set<string>();
  let held: boolean;
  do {
    const newlyHeld = [...selections].filter(
      ([id, { selected }]) =>
        selected?.script &&
        !collisions.has(id) &&
        findDuplicateModulePathScript(Object.values(planned), selected.script)
    );
    held = newlyHeld.length > 0;
    for (const [id] of newlyHeld) {
      collisions.add(id);
      held = true;
      if (state.documents[id]) {
        planned[id] = state.documents[id].script;
      } else {
        delete planned[id];
      }
    }
  } while (held);
  for (const [id, { selected, candidates }] of selections) {
    const local = state.documents[id];
    const tombstone = state.tombstones[id];
    const collision = collisions.has(id);
    if (selected && !collision) {
      if (selected.script) {
        state.documents[id] = {
          script: structuredClone(selected.script),
          revision: selected.revision,
          parents: selected.parents,
        };
        delete state.tombstones[id];
      } else {
        delete state.documents[id];
        state.tombstones[id] = {
          revision: selected.revision,
          parents: selected.parents,
        };
      }
      if ((local ?? tombstone)?.revision !== selected.revision) {
        delete state.artifacts[id];
        state.cssOutbox[id] = selected.revision;
      }
      delete state.syncConflicts[id];
    } else {
      state.syncConflicts[id] = candidates
        .filter((record) => record.revision !== local?.revision)
        .map((record) => ({
          id,
          revision: record.revision,
          parents: record.parents,
          ...(record.script ? { script: record.script } : {}),
          ...(collision
            ? {
                conflictReason:
                  "Another saved script already uses this module alias. Rename it or choose a version.",
              }
            : {}),
        }));
    }
  }
  for (const kind of ["settings", "modules", "layout"] as const) {
    const records = Object.values(state.drive.records).filter(
      (record) => record.kind === kind
    );
    let heads: string[] = [];
    for (const record of records) {
      heads = mergeSyncRevision(heads, record, state.drive.records).heads;
    }
    state.drive.heads[kind] = heads;
    if (heads.length === 1) {
      const record = state.drive.records[heads[0]];
      if (record.kind === "settings") {
        state.settings = structuredClone(record.value);
        state.settingsRevision = record.revision;
      }
      if (record.kind === "modules") {
        state.modules = structuredClone(record.value);
        state.moduleRevision = record.revision;
      }
      if (record.kind === "layout") {
        state.drive.layout = structuredClone(record.value);
        state.drive.layoutRevision = record.revision;
      }
    }
  }
  const changed =
    before !==
    JSON.stringify([
      state.documents,
      state.tombstones,
      state.settings,
      state.modules,
      state.drive.layout,
      state.syncConflicts,
      state.drive.heads,
    ]);
  if (changed) {
    state.generation++;
  }
  return changed;
}
export function resolveDrivePreference(
  state: StoredRepositoryState,
  kind: DrivePreference,
  revision: string,
  generation: number
): void {
  const drive = state.drive;
  if (
    !drive ||
    state.generation !== generation ||
    !drive.heads[kind]?.includes(revision)
  ) {
    throw new Error(
      "This conflict changed. Refresh before choosing a version."
    );
  }
  const chosen = drive.records[revision];
  if (chosen.kind !== kind) {
    throw new Error("Invalid preference conflict.");
  }
  const record = {
    ...chosen,
    revision: crypto.randomUUID(),
    parents: [...drive.heads[kind]],
  };
  remember(state, record, true);
  mergeDriveRecords(state, []);
}
