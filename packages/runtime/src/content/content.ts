/**
 * Content script - currently minimal as script injection is handled by background worker
 * This can be extended for additional features like communication with injected scripts
 */

console.log("Invert IDE content script loaded");

// Listen for messages from background or injected scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "ready" });
  }
  return true;
});
