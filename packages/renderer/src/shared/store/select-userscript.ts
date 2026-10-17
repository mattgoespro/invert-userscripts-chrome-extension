import { buildScriptFileUri, type ScriptEditorKind } from "@packages/monaco";
import type { Userscript } from "@shared/model";
import * as monaco from "monaco-editor";
import { ensureDraft, flushModelToDraft } from "./slices/editor-drafts";
import type { DraftBuffer } from "./slices/editor-drafts/state.editor-drafts";
import { setCurrentUserscript } from "./slices/userscripts";
import type { AppDispatch, RootState } from "./store";
import { captureSessionBuffers } from "../services/editor-session-service";

const SCRIPT_BUFFERS: Array<{
  editor: ScriptEditorKind;
  buffer: DraftBuffer;
}> = [
  { editor: "main", buffer: "typescript" },
  { editor: "types", buffer: "typeDefinitions" },
  { editor: "styles", buffer: "scss" },
];

/**
 * Copy live Monaco model text into the draft. This is the single owner of
 * Monaco → draft flush before selection changes; WorkspaceService must not
 * overwrite dirty attached buffers, and editors do not flush on unmount.
 */
export function flushScriptModelsToDraft(script: Userscript) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    if (!getState().editorDrafts.drafts[script.id]) {
      dispatch(ensureDraft(script));
    }

    const draft = getState().editorDrafts.drafts[script.id];
    const capture = captureSessionBuffers(draft, (buffer) => {
      const editor = SCRIPT_BUFFERS.find(
        (item) => item.buffer === buffer
      )!.editor;
      const model = monaco.editor.getModel(
        monaco.Uri.parse(buildScriptFileUri(script, editor))
      );
      return model && !model.isDisposed() ? model : null;
    });
    for (const { buffer } of SCRIPT_BUFFERS) {
      dispatch(
        flushModelToDraft({
          scriptId: script.id,
          buffer,
          code: capture.buffers[buffer],
        })
      );
    }
  };
}

/**
 * Select a userscript: flush the outgoing script's models, ensure a draft for
 * the incoming script, then set current. Ordering matters so store subscribers
 * (WorkspaceService) see a dirty draft on the first sync after selection.
 */
export function selectUserscript(scriptId: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const currentId = state.userscripts.currentScriptId;
    const current =
      currentId && currentId !== scriptId
        ? state.userscripts.scripts?.[currentId]
        : undefined;

    if (current) {
      dispatch(flushScriptModelsToDraft(current));
    }

    const next = state.userscripts.scripts?.[scriptId];

    if (next && !getState().editorDrafts.drafts[next.id]) {
      dispatch(ensureDraft(next));
    }

    dispatch(setCurrentUserscript(scriptId));
  };
}
