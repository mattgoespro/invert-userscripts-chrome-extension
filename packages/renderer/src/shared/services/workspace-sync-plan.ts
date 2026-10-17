import type { ScriptEditorKind, WorkspaceFile } from "@packages/monaco";
import {
  getScriptModulePath,
  type GlobalModules,
  type Userscript,
  type Userscripts,
} from "@shared/model";
import { resolveWorkspaceScriptClosure } from "@shared/workspace-closure";
import {
  isDraftDirty,
  type EditorDraft,
} from "../store/slices/editor-drafts/state.editor-drafts";
import { shouldMountTypesModel } from "./ambient-type-defs";

export interface WorkspaceProjectionInput {
  scripts: Userscripts;
  drafts: Record<string, EditorDraft>;
  currentScriptId: string | null | undefined;
  modules: GlobalModules;
  manifests?: Record<string, import("@shared/modules/manifest").ModuleManifest>;
}

export interface WorkspaceModel extends Omit<WorkspaceFile, "uri"> {
  script: Pick<Userscript, "id" | "moduleName">;
  editor: ScriptEditorKind;
}

export interface WorkspaceProjection {
  signature: string;
  models: WorkspaceModel[];
  modulePaths: string[];
  cdnModules: Array<{ id: string; packageName: string; typeVersion?: string }>;
}

/** The desired workspace, without subscriptions or Monaco effects. */
export function projectWorkspace(
  input: WorkspaceProjectionInput,
  previousSignature?: string
): WorkspaceProjection | null {
  const { scripts: scriptsMap, drafts, currentScriptId, modules } = input;
  const scripts = Object.values(scriptsMap);
  const currentScript = currentScriptId
    ? scriptsMap[currentScriptId]
    : undefined;
  const closureIds = resolveWorkspaceScriptClosure(currentScript, scriptsMap, {
    manifests: input.manifests,
    getTypescriptSource: (script) =>
      getDraftBuffer(script, drafts[script.id], "typescript").contents,
  });
  const dirtyDraftIds = Object.entries(drafts)
    .filter(([, draft]) => isDraftDirty(draft))
    .map(([scriptId]) => scriptId)
    .filter((scriptId) => scriptsMap[scriptId] != null);
  const cdnScopeIds = new Set([
    ...closureIds,
    ...(currentScript ? [currentScript.id] : []),
    ...dirtyDraftIds,
  ]);
  const models: WorkspaceModel[] = [];
  for (const script of scripts) {
    const isActive = script.id === currentScript?.id;
    const draft = drafts[script.id];
    const main = getDraftBuffer(script, draft, "typescript");
    const types = getDraftBuffer(script, draft, "typeDefinitions");
    models.push({
      script: { id: script.id, moduleName: script.moduleName },
      editor: "main",
      language: "typescript",
      contents: main.contents,
      preserveAttachedBuffer: main.dirty,
    });
    if (shouldMountTypesModel({ isActive, typeDefinitions: types.contents })) {
      models.push({
        script: { id: script.id, moduleName: script.moduleName },
        editor: "types",
        language: "typescript",
        contents: types.contents,
        preserveAttachedBuffer: types.dirty,
      });
    }
    if (isActive || isDraftDirty(draft)) {
      const styles = getDraftBuffer(script, draft, "scss");
      models.push({
        script: { id: script.id, moduleName: script.moduleName },
        editor: "styles",
        language: "scss",
        contents: styles.contents,
        preserveAttachedBuffer: styles.dirty,
      });
    }
  }

  const referencedModuleIds = new Set<string>();
  for (const scriptId of cdnScopeIds) {
    for (const moduleId of scriptsMap[scriptId]?.globalModules ?? []) {
      referencedModuleIds.add(moduleId);
    }
  }

  const desired = {
    models,
    modulePaths: scripts.map((script) => getScriptModulePath(script)),
    cdnModules: Object.values(modules).flatMap((module) =>
      referencedModuleIds.has(module.id) && module.packageName
        ? [
            {
              id: module.id,
              packageName: module.packageName,
              ...(module.typeVersion
                ? { typeVersion: module.typeVersion }
                : {}),
            },
          ]
        : []
    ),
  };
  const signature = JSON.stringify(desired);
  return signature === previousSignature ? null : { ...desired, signature };
}

export type DraftBufferContents = {
  contents: string;
  dirty: boolean;
};

/**
 * Resolve the effective buffer contents for workspace sync: prefer the draft
 * when present, otherwise the saved script. `dirty` drives
 * `preserveAttachedBuffer` so a stale store value cannot clobber in-progress typing.
 */
export function getDraftBuffer(
  script: Userscript,
  draft: EditorDraft | undefined,
  buffer: "typescript" | "scss" | "typeDefinitions"
): DraftBufferContents {
  if (!draft) {
    return {
      contents:
        buffer === "typeDefinitions"
          ? (script.typeDefinitions ?? "")
          : script.code.source[buffer],
      dirty: false,
    };
  }

  return { contents: draft[buffer], dirty: draft.dirty[buffer] };
}
