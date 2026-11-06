import type { ApplyScriptsResponse } from "@shared/messages";
import { transactionalEnabled } from "@shared/publication/client";
import { documentRepository } from "./coordinator";
export interface EffectRecord {
  status: "started" | "completed";
  result?: ApplyScriptsResponse;
}
export function effectDecision(
  record: EffectRecord | undefined
): (ApplyScriptsResponse & { status?: string }) | null {
  if (!record) {
    return null;
  }
  return record.status === "completed" && record.result
    ? record.result
    : {
        status: "unknown",
        success: false,
        appliedTabCount: 0,
        message:
          "The browser stopped during execution. Its outcome is unknown; reapply explicitly if needed.",
      };
}
const running = new Map<string, Promise<ApplyScriptsResponse>>();
/**
 * Tab work serializes in its tab queue and revalidates saved state, so one tab
 * cannot hold up another here. Records commit in order through IndexedDB
 * readwrite transactions; a retry of a running effect joins it instead of
 * reading its "started" record as an interrupted outcome.
 */
export function runPublicationEffect(
  id: string,
  execute: () => Promise<ApplyScriptsResponse>
): Promise<ApplyScriptsResponse> {
  const current = running.get(id);
  if (current) {
    return current;
  }
  const task = recordPublicationEffect(id, execute).finally(() => {
    running.delete(id);
  });
  running.set(id, task);
  return task;
}
async function recordPublicationEffect(
  id: string,
  execute: () => Promise<ApplyScriptsResponse>
): Promise<ApplyScriptsResponse> {
  const durable = await transactionalEnabled();
  if (durable) {
    const previous = await documentRepository.update((state) => {
      state.effects ??= {};
      // Navigation records moved to the session ledger; drop those left behind.
      for (const key of Object.keys(state.effects)) {
        if (key.startsWith("navigation:")) {
          delete state.effects[key];
        }
      }
      const decision = effectDecision(state.effects[id]);
      if (!decision) {
        state.effects[id] = { status: "started" };
      }
      return { state, value: decision };
    });
    if (previous) {
      return previous;
    }
  }
  let result: ApplyScriptsResponse;
  try {
    result = await execute();
  } catch (error) {
    result = {
      ...(error instanceof Error && error.name === "UnknownExecutionError"
        ? { status: "unknown" as const }
        : {}),
      success: false,
      appliedTabCount: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (durable) {
    await documentRepository.update((state) => {
      state.effects[id] = { status: "completed", result };
      return { state, value: undefined };
    });
  }
  return result;
}
