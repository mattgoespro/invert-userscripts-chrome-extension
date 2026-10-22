import { reconcilePendingCss } from "./publication/css-reconciliation";
import {
  onTabActivated,
  onTabRemoved,
  onTabUpdated,
} from "./handlers/component-handlers/tab.handler";
import { onWebNavigationCompleted } from "./handlers/extension-handlers/navigation.handler";
import {
  onInstalled,
  onMessage,
} from "./handlers/extension-handlers/runtime.handler";

/**
 * Runtime listeners
 */
import { installRepositoryTransport } from "@shared/publication/client";
import {
  handleRepositoryRequest,
  documentRepository,
  notifyPublication,
} from "./publication/coordinator";
import { onPublicationMessage } from "./publication/command-handler";
import {
  flushSync,
  ingestVerifiedSync,
  ingestPortablePreferences,
  ingestLegacySync,
} from "./sync/sync-service";
import { initializeDriveSync } from "./drive/bootstrap";
import { driveConfigured } from "./drive/transport";
installRepositoryTransport(handleRepositoryRequest);
initializeDriveSync(
  documentRepository,
  () => handleRepositoryRequest({ type: "publication.activate" }),
  () => {
    notifyPublication();
    void reconcilePendingCss(documentRepository).catch(console.error);
  }
);
chrome.runtime.onMessage.addListener(onPublicationMessage);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") {
    void chrome.storage.local
      .get(["publicationBackend", "verifiedSync", "driveSyncEnabled"])
      .then(async (flags) => {
        if (flags.driveSyncEnabled || driveConfigured()) {
          return;
        }
        if (
          flags.publicationBackend === "transactional" &&
          flags.verifiedSync
        ) {
          await ingestVerifiedSync(documentRepository);
          notifyPublication();
          void reconcilePendingCss(documentRepository).catch(console.error);
        }
        if (
          flags.publicationBackend === "transactional" &&
          !flags.verifiedSync &&
          (await ingestLegacySync(documentRepository))
        ) {
          notifyPublication();
          void reconcilePendingCss(documentRepository).catch(console.error);
        }
        if (
          flags.publicationBackend === "transactional" &&
          (await ingestPortablePreferences(documentRepository))
        ) {
          notifyPublication();
          void reconcilePendingCss(documentRepository).catch(console.error);
        }
      })
      .catch(console.error);
  }
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "publication-css-retry") {
    void reconcilePendingCss(documentRepository).catch(console.error);
  }
  if (alarm.name === "publication-sync-retry") {
    void flushSync(documentRepository).catch(console.error);
  }
});
chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.local
    .get("publicationBackend")
    .then((flags) => {
      if (flags.publicationBackend === "transactional") {
        return flushSync(documentRepository);
      }
    })
    .catch(console.error);
});
chrome.runtime.onInstalled.addListener(onInstalled);

/**
 * Web navigation listeners
 */
chrome.webNavigation.onCompleted.addListener(onWebNavigationCompleted);

/**
 * Runtime message listeners
 */
chrome.runtime.onMessage.addListener(onMessage);

/**
 * Tab activation listeners
 */
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onActivated.addListener(onTabActivated);
chrome.tabs.onRemoved.addListener(onTabRemoved);

// Every worker generation repairs missed observations and resumes CSS, never JavaScript.
void chrome.storage.local
  .get(["publicationBackend", "verifiedSync", "driveSyncEnabled"])
  .then(async (flags) => {
    if (flags.driveSyncEnabled || driveConfigured()) {
      return;
    }
    if (flags.publicationBackend !== "transactional") {
      return;
    }
    if (flags.verifiedSync) {
      await ingestVerifiedSync(documentRepository);
    } else {
      await ingestLegacySync(documentRepository);
    }
    await ingestPortablePreferences(documentRepository);
    notifyPublication();
    await Promise.all([
      reconcilePendingCss(documentRepository),
      flushSync(documentRepository),
    ]);
  })
  .catch(console.error);
