import type { ApplyScriptsResponse } from "@shared/messages";
import type { ApplyOutcome } from "@shared/publication/contracts";

/** A page effect cannot roll back a completed durable publication. */
export async function applyAfterCommit(
  scriptIds: string[],
  apply: (ids: string[]) => Promise<ApplyScriptsResponse>
): Promise<ApplyOutcome> {
  try {
    const result = await apply(scriptIds);
    return {
      status:
        result.status === "unknown"
          ? "unknown"
          : result.success
            ? "applied"
            : "partial",
      message: result.message,
      appliedTabCount: result.appliedTabCount,
      removedTabCount: result.removedTabCount ?? 0,
      staleSkipCount: result.staleSkipCount ?? 0,
    };
  } catch (error) {
    return {
      status: "blocked",
      appliedTabCount: 0,
      removedTabCount: 0,
      staleSkipCount: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
