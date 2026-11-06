import type * as monaco from "monaco-editor";
import type { ApplyScriptsResponse } from "@shared/messages";
import type { CompiledCodeEntry, Userscript, Userscripts } from "@shared/model";
import type { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { publishDraft } from "./userscript-publication";
import {
  applySaveRejectionDirtyRestore,
  clearSaveBaseline,
} from "../store/slices/editor-drafts/editor-drafts-transitions";
import {
  isDraftDirty,
  type DraftBuffer,
  type EditorDraft,
  type EditorDraftsState,
} from "../store/slices/editor-drafts/state.editor-drafts";

export interface PersistScriptBuffersArgs {
  expectedRevision?: string;
  expectedSource?: Record<DraftBuffer, string>;
  scriptId: string;
  focusedBuffer?: {
    buffer: DraftBuffer;
    code: string;
    autoFormat: boolean;
  };
  /** A batch may supply the conflict observation captured when it began. */
  conflictId?: string | null;
  applyTabs?: boolean;
  /** Types-pane saves bypass compilation and shared-import errors. */
  compile?: boolean;
}

/** What a queued save expects storage to hold once its turn comes. */
export type DraftSaveBaseline = Pick<
  PersistScriptBuffersArgs,
  "expectedRevision" | "expectedSource"
>;

export interface DraftSaveResult {
  script: Userscript;
  conflictId: string | null;
  appliedTabCount: number;
  applySuccess: boolean;
  staleSkipCount: number;
}

export interface DraftSaveContext {
  requestId: string;
  getState: () => {
    userscripts: { scripts?: Userscripts };
    editorDrafts: {
      drafts: Record<string, EditorDraft>;
      pendingConflicts?: EditorDraftsState["pendingConflicts"];
    };
  };
  sourceStorage: Pick<
    typeof ChromeSyncStorage,
    "getAllScripts" | "saveScript" | "updateScript"
  > &
    Partial<Pick<typeof ChromeSyncStorage, "tryPublishScript">>;
  compiledStorage: Pick<
    typeof CompiledCodeStorage,
    "getCompiledCode" | "saveCompiledCode"
  >;
  compile: (script: Userscript) => Promise<CompiledCodeEntry>;
  format: (code: string, language: "typescript" | "scss") => Promise<string>;
  /** Accept durable source/artifact state before tab-application feedback. */
  acceptPublished?: (script: Userscript) => void;
  /** The source write landed; a later artifact failure must keep its baseline. */
  confirmSourceWrite?: () => void;
  apply: (scriptIds: string[]) => Promise<ApplyScriptsResponse>;
  commit: (payload: {
    scriptId: string;
    buffer: DraftBuffer;
    code: string;
    snapshotCode: string;
    saveRequestId: string;
  }) => void;
}

const BUFFERS: DraftBuffer[] = ["typescript", "scss", "typeDefinitions"];
export async function persistDraftSave(
  args: PersistScriptBuffersArgs,
  context: DraftSaveContext
): Promise<DraftSaveResult> {
  const state = context.getState();
  const draft = state.editorDrafts.drafts[args.scriptId];
  if (!draft) {
    throw new Error(`No editor draft found for script: ${args.scriptId}`);
  }

  const snapshot: Record<DraftBuffer, string> = {
    typescript: draft.typescript,
    scss: draft.scss,
    typeDefinitions: draft.typeDefinitions,
  };
  if (args.focusedBuffer) {
    snapshot[args.focusedBuffer.buffer] = args.focusedBuffer.code;
  }
  const buffers = { ...snapshot };
  // Resolving a conflict is pinned to the version the user chose to overwrite.
  const pinned: DraftSaveBaseline | undefined =
    args.expectedRevision !== undefined || args.conflictId
      ? {
          expectedRevision:
            args.expectedRevision ??
            state.editorDrafts.pendingConflicts?.[args.scriptId]?.remoteScript
              .storageRevision,
          expectedSource: { ...draft.lastSynced },
        }
      : undefined;
  // An ordinary save expects whatever the saves queued ahead of it published.
  const observeBaseline = (): DraftSaveBaseline => {
    if (pinned) {
      return pinned;
    }
    const current =
      context.getState().editorDrafts.drafts[args.scriptId] ?? draft;
    return {
      expectedRevision: current.baseSavedRevision,
      expectedSource: { ...current.lastSynced },
    };
  };
  return publishDraft(
    {
      ...args,
      conflictId:
        args.conflictId === undefined
          ? (state.editorDrafts.pendingConflicts?.[args.scriptId]?.conflictId ??
            null)
          : args.conflictId,
    },
    context,
    snapshot,
    buffers,
    state.userscripts.scripts ?? {},
    observeBaseline
  );
}

/** Complete only unchanged buffers still owned by this save. */
export function completeDraftSave(
  state: EditorDraftsState,
  script: Userscript,
  requestId: string,
  conflictId: string | null = null
): void {
  const draft = state.drafts[script.id];
  if (!draft) {
    return;
  }
  clearSaveBaseline(draft, requestId);
  if (
    script.storageRevision &&
    BUFFERS.some((buffer) => draft.lastSaveRequestId[buffer] === requestId)
  ) {
    draft.baseSavedRevision = script.storageRevision;
  }
  let changed = false;
  for (const buffer of BUFFERS) {
    if (draft.lastSaveRequestId[buffer] !== requestId || draft.dirty[buffer]) {
      continue;
    }
    const code =
      buffer === "typeDefinitions"
        ? (script.typeDefinitions ?? "")
        : script.code.source[buffer];
    draft[buffer] = code;
    draft.lastSynced[buffer] = code;
    changed = true;
  }
  if (changed) {
    draft.revision += 1;
  }
  if (
    !isDraftDirty(draft) &&
    conflictId !== null &&
    state.pendingConflicts[script.id]?.conflictId === conflictId
  ) {
    delete state.pendingConflicts[script.id];
  }
}

export function rejectDraftSave(
  state: EditorDraftsState,
  scriptId: string,
  requestId: string
): void {
  const draft = state.drafts[scriptId];
  if (draft) {
    for (const buffer of BUFFERS) {
      applySaveRejectionDirtyRestore(draft, buffer, requestId);
    }
    clearSaveBaseline(draft, requestId);
  }
}

/** Formatting belongs to the model and version that requested the save. */
export function captureEditorSave(
  editor: Pick<
    monaco.editor.IStandaloneCodeEditor,
    "getModel" | "getSelections" | "executeEdits"
  >
): (savedCode: string) => void {
  const model = editor.getModel();
  const version = model?.getVersionId();
  return (savedCode: string): void => {
    if (
      !model ||
      model.isDisposed() ||
      editor.getModel() !== model ||
      model.getVersionId() !== version ||
      model.getValue() === savedCode
    ) {
      return;
    }
    editor.executeEdits(
      "prettier-format",
      [{ range: model.getFullModelRange(), text: savedCode }],
      editor.getSelections() ?? []
    );
  };
}
