import type {
  ApplyScriptsResponse,
  RuntimePortMessageEvent,
} from "@shared/messages";

const EMPTY_APPLY_RESPONSE: ApplyScriptsResponse = {
  success: false,
  appliedTabCount: 0,
  removedTabCount: 0,
  staleSkipCount: 0,
};

export async function sendApplyScriptsMessage(
  scriptIds: string[]
): Promise<ApplyScriptsResponse> {
  const message: RuntimePortMessageEvent<"applyScripts"> = {
    source: "options",
    type: "applyScripts",
    data: { scriptIds },
  };

  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      | ApplyScriptsResponse
      | undefined;

    return response ?? EMPTY_APPLY_RESPONSE;
  } catch (error) {
    console.warn("Failed to send applyScripts message:", error);
    return EMPTY_APPLY_RESPONSE;
  }
}

export async function sendSetEnabledMessage(
  scriptId: string,
  enabled: boolean
): Promise<ApplyScriptsResponse> {
  const message: RuntimePortMessageEvent<"setEnabled"> = {
    source: "options",
    type: "setEnabled",
    data: { scriptId, enabled },
  };

  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      | ApplyScriptsResponse
      | undefined;

    return response ?? EMPTY_APPLY_RESPONSE;
  } catch (error) {
    console.warn("Failed to send setEnabled message:", error);
    return EMPTY_APPLY_RESPONSE;
  }
}

export function formatMatchingTabsToast(
  count: number,
  verb: "Applied to" | "Removed from"
): string {
  const noun = count === 1 ? "tab" : "tabs";
  return `${verb} ${count} matching ${noun}`;
}

export function formatApplyFailureToast(appliedTabCount: number): string {
  if (appliedTabCount > 0) {
    return `Applied to ${appliedTabCount} matching ${appliedTabCount === 1 ? "tab" : "tabs"}, but some injections failed.`;
  }

  return "Failed to inject the script into matching tabs.";
}

export function formatStaleSkipToast(): string {
  return "Matching tabs were skipped until compiled output is current.";
}

export function describeApplyResult(result: {
  success: boolean;
  appliedTabCount: number;
  staleSkipCount?: number;
}): { variant: "info" | "error"; message: string } {
  if (!result.success) {
    return {
      variant: "error",
      message: formatApplyFailureToast(result.appliedTabCount),
    };
  }

  if (result.appliedTabCount === 0 && (result.staleSkipCount ?? 0) > 0) {
    return {
      variant: "info",
      message: formatStaleSkipToast(),
    };
  }

  if (result.appliedTabCount > 0 && (result.staleSkipCount ?? 0) > 0) {
    return {
      variant: "info",
      message: `${formatMatchingTabsToast(result.appliedTabCount, "Applied to")}. Some matching tabs were skipped until compiled output is current.`,
    };
  }

  return {
    variant: "info",
    message: formatMatchingTabsToast(result.appliedTabCount, "Applied to"),
  };
}
