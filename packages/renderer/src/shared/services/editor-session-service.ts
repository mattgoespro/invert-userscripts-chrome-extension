import type {
  ScriptBuffer,
  SourceBuffers,
} from "@shared/publication/contracts";
interface SessionModel {
  getValue(): string;
  getVersionId(): number;
}
export interface CapturedSession {
  buffers: SourceBuffers;
  modelVersions: Partial<Record<ScriptBuffer, number>>;
}
export function captureSessionBuffers(
  fallback: SourceBuffers,
  model: (buffer: ScriptBuffer) => SessionModel | null
): CapturedSession {
  const buffers = { ...fallback };
  const modelVersions: CapturedSession["modelVersions"] = {};
  for (const buffer of ["typescript", "scss", "typeDefinitions"] as const) {
    const live = model(buffer);
    if (live) {
      buffers[buffer] = live.getValue();
      modelVersions[buffer] = live.getVersionId();
    }
  }
  return { buffers, modelVersions };
}
export function canRestoreCheckpoint(
  baseRevision: string,
  currentRevision: string | null
): boolean {
  return baseRevision === currentRevision;
}
export interface RecoveryCheckpoint {
  tabId?: number;
  scriptId: string;
  sessionId: string;
  baseRevision: string;
  buffers: SourceBuffers;
  updatedAt: number;
}
export async function checkpointSession(
  checkpoint: RecoveryCheckpoint
): Promise<void> {
  await chrome.storage.local.set({
    ["draft-recovery:" + checkpoint.sessionId + ":" + checkpoint.scriptId]:
      checkpoint,
  });
}
