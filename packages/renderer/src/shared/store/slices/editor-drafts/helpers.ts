import { Userscript } from "@shared/model";
import type { RootState } from "../../store";
import {
  draftFromScript,
  DraftBuffer,
  EditorDraft,
  RemoteDraftConflict,
  RemoteDraftConflictBuffer,
} from "./state.editor-drafts";

export function getDraftOrSavedSource(
  state: RootState,
  scriptId: string
): Pick<EditorDraft, "typescript" | "scss" | "typeDefinitions"> {
  const draft = state.editorDrafts.drafts[scriptId];
  const script = state.userscripts.scripts?.[scriptId];

  if (draft) {
    return {
      typescript: draft.typescript,
      scss: draft.scss,
      typeDefinitions: draft.typeDefinitions,
    };
  }

  return {
    typescript: script?.code.source.typescript ?? "",
    scss: script?.code.source.scss ?? "",
    typeDefinitions: script?.typeDefinitions ?? "",
  };
}

export function buildScriptWithDraftSource(
  script: Userscript,
  draftSource: Pick<EditorDraft, "typescript" | "scss" | "typeDefinitions">
): Userscript {
  return {
    ...script,
    typeDefinitions: draftSource.typeDefinitions,
    code: {
      ...script.code,
      source: {
        typescript: draftSource.typescript,
        scss: draftSource.scss,
      },
    },
  };
}

export function detectDraftConflict(
  scriptId: string,
  localDraft: EditorDraft,
  remoteScript: Userscript
): RemoteDraftConflict | null {
  const dirtyBuffers = getDirtyBuffers(localDraft);

  if (dirtyBuffers.length === 0) {
    return null;
  }

  const remoteBuffers: Record<DraftBuffer, string> = {
    typescript: remoteScript.code.source.typescript,
    scss: remoteScript.code.source.scss,
    typeDefinitions: remoteScript.typeDefinitions ?? "",
  };

  const localBuffers: Record<DraftBuffer, string> = {
    typescript: localDraft.typescript,
    scss: localDraft.scss,
    typeDefinitions: localDraft.typeDefinitions,
  };

  const conflictingBuffers = dirtyBuffers.filter(
    (buffer) => localBuffers[buffer] !== remoteBuffers[buffer]
  );

  if (conflictingBuffers.length === 0) {
    return null;
  }

  const buffers: RemoteDraftConflictBuffer[] = conflictingBuffers.map(
    (buffer) => ({
      buffer,
      local: localBuffers[buffer],
      remote: remoteBuffers[buffer],
    })
  );

  return {
    scriptId,
    scriptName: remoteScript.name,
    remoteScript,
    buffers,
  };
}

function getDirtyBuffers(draft: EditorDraft): DraftBuffer[] {
  return (Object.entries(draft.dirty) as Array<[DraftBuffer, boolean]>)
    .filter(([, dirty]) => dirty)
    .map(([buffer]) => buffer);
}

export function extractUserscriptMetadataUpdates(
  updates: Partial<Userscript>
): Partial<
  Pick<
    Userscript,
    | "name"
    | "enabled"
    | "shared"
    | "moduleName"
    | "globalModules"
    | "urlPatterns"
    | "runAt"
  >
> {
  const {
    name,
    enabled,
    shared,
    moduleName,
    globalModules,
    urlPatterns,
    runAt,
  } = updates;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(shared !== undefined ? { shared } : {}),
    ...(moduleName !== undefined ? { moduleName } : {}),
    ...(globalModules !== undefined ? { globalModules } : {}),
    ...(urlPatterns !== undefined ? { urlPatterns } : {}),
    ...(runAt !== undefined ? { runAt } : {}),
  };
}

export { draftFromScript };
