import type { AppStore } from "../store/store";
import {
  updateDraftBuffer,
  enqueueConflict,
  ensureDraft,
} from "../store/slices/editor-drafts";
import { sha256 } from "@shared/storage/sync/revision-codec";
import {
  checkpointSession,
  type RecoveryCheckpoint,
} from "./editor-session-service";
const prefix = "draft-recovery:";
const consumed = new Map<string, string[]>();
function sessionId(): string {
  let id = sessionStorage.getItem("invert-editor-session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("invert-editor-session", id);
  }
  return id;
}
export async function restoreDraftRecovery(store: AppStore): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const currentTab = await chrome.tabs.getCurrent();
  const candidates = Object.entries(all)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => ({ key, checkpoint: value as RecoveryCheckpoint }))
    .sort((a, b) => b.checkpoint.updatedAt - a.checkpoint.updatedAt);
  const restored = new Set<string>();
  for (const { key, checkpoint } of candidates) {
    if (checkpoint.tabId && checkpoint.tabId !== currentTab?.id) {
      try {
        await chrome.tabs.get(checkpoint.tabId);
        continue;
      } catch {
        /* Closed window's recovery is available. */
      }
    }
    const script = store.getState().userscripts.scripts[checkpoint.scriptId];
    if (
      !script ||
      restored.has(script.id) ||
      !checkpoint.buffers ||
      !Object.values(checkpoint.buffers).every(
        (value) => typeof value === "string"
      )
    ) {
      continue;
    }
    restored.add(script.id);
    consumed.set(script.id, [...(consumed.get(script.id) ?? []), key]);
    const saved = {
      ...script.code.source,
      typeDefinitions: script.typeDefinitions ?? "",
    };
    store.dispatch(ensureDraft(script));
    for (const buffer of ["typescript", "scss", "typeDefinitions"] as const) {
      store.dispatch(
        updateDraftBuffer({
          scriptId: script.id,
          buffer,
          code: checkpoint.buffers[buffer],
        })
      );
    }
    if (
      (await sha256(JSON.stringify(saved))) !== checkpoint.baseRevision &&
      (["typescript", "scss", "typeDefinitions"] as const).some(
        (buffer) => checkpoint.buffers[buffer] !== saved[buffer]
      )
    ) {
      store.dispatch(
        enqueueConflict({
          scriptId: script.id,
          scriptName: script.name,
          remoteScript: script,
          buffers: (["typescript", "scss", "typeDefinitions"] as const)
            .filter((buffer) => checkpoint.buffers[buffer] !== saved[buffer])
            .map((buffer) => ({
              buffer,
              local: checkpoint.buffers[buffer],
              remote: saved[buffer],
            })),
        })
      );
    }
  }
}
export function startDraftRecovery(store: AppStore): () => void {
  const id = sessionId();
  let tabId: number | undefined;
  void chrome.tabs.getCurrent().then((tab) => {
    tabId = tab?.id;
  });
  const known = new Set(consumed.keys());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let last = store.getState().editorDrafts.drafts;
  const flush = async (): Promise<void> => {
    const current = ++generation;
    const state = store.getState();
    for (const scriptId of known) {
      const draft = state.editorDrafts.drafts[scriptId];
      if (
        state.userscripts.scripts[scriptId] &&
        (!draft || !Object.values(draft.dirty).some(Boolean))
      ) {
        await chrome.storage.local.remove([
          prefix + id + ":" + scriptId,
          ...(consumed.get(scriptId) ?? []),
        ]);
        consumed.delete(scriptId);
        known.delete(scriptId);
      }
    }
    for (const [scriptId, draft] of Object.entries(state.editorDrafts.drafts)) {
      const key = prefix + id + ":" + scriptId;
      if (!Object.values(draft.dirty).some(Boolean)) {
        await chrome.storage.local.remove(key);
        continue;
      }
      const baseRevision = await sha256(JSON.stringify(draft.lastSynced));
      if (current !== generation) {
        return;
      }
      known.add(scriptId);
      await checkpointSession({
        sessionId: id,
        tabId,
        scriptId,
        baseRevision,
        buffers: {
          typescript: draft.typescript,
          scss: draft.scss,
          typeDefinitions: draft.typeDefinitions,
        },
        updatedAt: Date.now(),
      });
    }
  };
  const unsubscribe = store.subscribe(() => {
    const drafts = store.getState().editorDrafts.drafts;
    if (drafts === last) {
      return;
    }
    last = drafts;
    clearTimeout(timer);
    timer = setTimeout(() => void flush().catch(console.error), 500);
  });
  const hide = () => {
    clearTimeout(timer);
    void flush().catch(console.error);
  };
  window.addEventListener("pagehide", hide);
  return () => {
    unsubscribe();
    window.removeEventListener("pagehide", hide);
    clearTimeout(timer);
    void flush().catch(console.error);
  };
}
