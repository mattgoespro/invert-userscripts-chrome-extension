import { onWebNavigationCompleted } from "./handlers/extension-handlers/navigation.handler";
import { onInstalled, onMessage } from "./handlers/extension-handlers/runtime.handler";

/**
 * Runtime listeners
 */
chrome.runtime.onInstalled.addListener(onInstalled);

/**
 * Web navigation listeners
 */
chrome.webNavigation.onCompleted.addListener(onWebNavigationCompleted);

/**
 * Runtime message listeners
 */
chrome.runtime.onMessage.addListener(onMessage);
