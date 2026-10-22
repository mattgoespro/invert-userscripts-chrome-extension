import { enableDriveState, isDriveLayout } from "@shared/storage/drive-sync";
import { LegacyChromeSyncStorage } from "@shared/storage/sync.storage";
import { authorizeDrive, driveConfigured } from "./transport";
import { DriveSyncService } from "./service";
import { installDriveRuntime } from "./runtime";
import type { IndexedDocumentRepository } from "@shared/storage/indexeddb/repository";
import type { DriveStatus } from "@shared/storage/drive-sync";
import type { GlobalState } from "@shared/storage/global-state.storage";
import type { DriveRepository } from "./service";
import { isCompiledArtifactFresh } from "@shared/compile-metadata";

export function chooseDriveLayout(
  local: Record<string, unknown>,
  legacy: unknown
): GlobalState | undefined {
  const candidates = [
    local["globalState:last"],
    ...Object.entries(local)
      .filter(
        ([key]) => key.startsWith("globalState:") && key !== "globalState:last"
      )
      .reverse()
      .map(([, value]) => value),
    local.globalState,
    legacy,
  ];
  return candidates.find(isDriveLayout) as GlobalState | undefined;
}
export async function ensureRestoreCompiler(
  repository: Pick<DriveRepository, "state">
): Promise<void> {
  const state = await repository.state();
  if (
    !Object.values(state.documents).some(
      (document) =>
        !isCompiledArtifactFresh(
          document.script,
          state.artifacts[document.script.id],
          state.settings.minifyCompiledOutput ?? false
        )
    )
  ) {
    return;
  }
  const tabs = await chrome.tabs.query({
    url: chrome.runtime.getURL("options.html"),
  });
  if (!tabs.length) {
    await chrome.runtime.openOptionsPage();
  }
}

export function initializeDriveSync(
  repository: IndexedDocumentRepository,
  activate: () => Promise<unknown>,
  notify: () => void
): DriveSyncService {
  let preparation: Promise<void> | undefined;
  const prepare = (): Promise<void> => {
    preparation ??= (async () => {
      const [state, flags] = await Promise.all([
        repository.state(),
        chrome.storage.local.get(["driveSyncEnabled", "publicationBackend"]),
      ]);
      if (
        state.drive &&
        flags.driveSyncEnabled &&
        flags.publicationBackend === "transactional"
      ) {
        return;
      }
      // Switch native transport off before activation can start a legacy drain.
      await chrome.storage.local.set({ driveSyncEnabled: true });
      await activate();
      const [legacy, local] = await Promise.all([
        chrome.storage.sync.get(["globalState"]),
        chrome.storage.local.get(null),
      ]);
      await repository.update((state) => {
        enableDriveState(state, {
          settings: Object.entries(state.settings).some(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(
                LegacyChromeSyncStorage.defaultSettings[
                  key as keyof typeof LegacyChromeSyncStorage.defaultSettings
                ]
              )
          ),
          modules: Object.keys(state.modules).length > 0,
          layout: chooseDriveLayout(local, legacy.globalState),
        });
        return { state, value: undefined };
      });
    })().finally(() => {
      // Coalesce only in-flight work. Durable storage/flags may be cleared while
      // this worker stays alive, so a fulfilled promise cannot prove readiness.
      preparation = undefined;
    });
    return preparation;
  };
  const restored = (): void => {
    notify();
    void chrome.runtime.sendMessage({ type: "driveRestored" }).catch(() => {});
    void ensureRestoreCompiler(repository).catch(console.error);
  };
  const service = new DriveSyncService({
    repository,
    configured: driveConfigured,
    prepare,
    authorize: authorizeDrive,
    writeStatus: async (status) => {
      await chrome.storage.local.set({ driveSyncStatus: status });
    },
    readStatus: async () =>
      (await chrome.storage.local.get("driveSyncStatus")).driveSyncStatus as
        | DriveStatus
        | undefined,
    clearAuthorization: async () => {
      await chrome.alarms.clear("drive-sync");
      await chrome.identity.clearAllCachedAuthTokens();
    },
    retry: async () => {
      await chrome.alarms.create("drive-sync", { periodInMinutes: 1 });
    },
    notify: restored,
  });
  installDriveRuntime({ service, repository, prepare, notify: restored });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "drive-sync") {
      void service.run().catch(console.error);
    }
  });
  chrome.runtime.onInstalled.addListener(() => {
    void service.run().catch(console.error);
  });
  chrome.runtime.onStartup.addListener(() => {
    void service.run().catch(console.error);
  });
  chrome.identity.onSignInChanged.addListener((_account, signedIn) => {
    service.invalidate();
    if (!signedIn) {
      void chrome.identity.clearAllCachedAuthTokens().catch(console.error);
      return;
    }
    void service
      .run()
      .then(() => service.run())
      .catch(console.error);
  });
  void service.run().catch(console.error);
  return service;
}
