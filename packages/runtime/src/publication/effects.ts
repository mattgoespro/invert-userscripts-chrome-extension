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
let pending = Promise.resolve();
export function runPublicationEffect(
  id: string,
  execute: () => Promise<ApplyScriptsResponse>
): Promise<ApplyScriptsResponse> {
  const task = pending.then(async () => {
    const durable = await transactionalEnabled();
    if (durable) {
      const previous = await documentRepository.update((state) => {
        state.effects ??= {};
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
  });
  pending = task.then(
    () => {},
    () => {}
  );
  return task;
}
