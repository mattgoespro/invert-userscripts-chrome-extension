import { runPublicationEffect } from "../../publication/effects";
import { isTrustedExtensionSender } from "@shared/publication/protocol";
import type {
  ApplyScriptsResponse,
  RuntimePortMessageEvent,
} from "@shared/messages";
import { updateBadgeForTab } from "../../ide/badge";
import {
  applyScriptsToMatchingTabs,
  loadRuntimeInjectionState,
  removeScriptFromMatchingTabs,
} from "../../ide/scripts";

export const onInstalled = (_details: chrome.runtime.InstalledDetails) => {
  console.log("Invert IDE Userscripts extension installed.");
};

async function refreshBadgesForOpenTabs(): Promise<void> {
  const [tabs, injectionState] = await Promise.all([
    chrome.tabs.query({}),
    loadRuntimeInjectionState(),
  ]);

  for (const tab of tabs) {
    if (tab.id && tab.url) {
      await updateBadgeForTab(tab.id, tab.url, injectionState.scriptsMap);
    }
  }
}

export const onMessage = (
  message: RuntimePortMessageEvent,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  if (!["applyScripts", "setEnabled", "refreshTabs"].includes(message?.type)) {
    return;
  }
  if (!isTrustedExtensionSender(sender, chrome.runtime.id)) {
    sendResponse({
      success: false,
      appliedTabCount: 0,
      message: "Untrusted script command sender.",
    });
    return false;
  }
  if (
    message.type === "applyScripts" &&
    (!Array.isArray(message.data?.scriptIds) ||
      !message.data.scriptIds.every((id) => typeof id === "string"))
  ) {
    sendResponse({ success: false, appliedTabCount: 0 });
    return false;
  }
  if (
    message.type === "setEnabled" &&
    (typeof message.data?.scriptId !== "string" ||
      typeof message.data.enabled !== "boolean")
  ) {
    sendResponse({ success: false, appliedTabCount: 0 });
    return false;
  }
  const requestId =
    message.type === "refreshTabs"
      ? crypto.randomUUID()
      : (message.data.requestId ?? crypto.randomUUID());
  void runPublicationEffect(requestId, async () => {
    let response: ApplyScriptsResponse;
    if (message.type === "setEnabled" && !message.data.enabled) {
      const result = await removeScriptFromMatchingTabs(message.data.scriptId);
      response = {
        success: true,
        appliedTabCount: 0,
        removedTabCount: result.removedTabCount,
      };
    } else {
      const ids =
        message.type === "applyScripts"
          ? message.data.scriptIds
          : message.type === "setEnabled"
            ? [message.data.scriptId]
            : [];
      response = await applyScriptsToMatchingTabs(ids);
    }
    await refreshBadgesForOpenTabs();
    return response;
  }).then(sendResponse, (error) =>
    sendResponse({ success: false, appliedTabCount: 0, message: String(error) })
  );
  return true;
};
