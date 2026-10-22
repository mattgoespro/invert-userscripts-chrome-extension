import { reconcilePendingCss } from "./css-reconciliation";
import { handleDriveRequest, scheduleDriveSync } from "../drive/runtime";
import { captureDriveScript } from "@shared/storage/drive-sync";
import { findDuplicateModulePathScript } from "@shared/model";
import { applyLegacyMutation } from "@shared/publication/legacy-mutation";
import { IndexedDocumentRepository } from "@shared/storage/indexeddb/repository";
import { migrateLegacyDocuments } from "@shared/storage/indexeddb/migration";
import { LegacyChromeSyncStorage } from "@shared/storage/sync.storage";
import { LegacyCompiledCodeStorage } from "@shared/storage/compiled.storage";
import { isPublicationCommand } from "@shared/publication/protocol";
import {
  isCompiledArtifactFresh,
  digestUserscriptCompileSources,
} from "@shared/compile-metadata";
import type { RepositoryRequest } from "@shared/publication/client";
import {
  flushSync,
  ingestVerifiedSync,
  enableVerifiedReplication,
} from "../sync/sync-service";
export const documentRepository = new IndexedDocumentRepository();
let queue = Promise.resolve();
let activation: Promise<unknown> | undefined;
export function notifyPublication(): void {
  void chrome.runtime
    .sendMessage({ type: "publicationCommitted" })
    .catch(() => {});
}
export async function handleRepositoryRequest(
  request: RepositoryRequest
): Promise<unknown> {
  if (request.type.startsWith("publication.drive.")) {
    return handleDriveRequest(request);
  }
  if (request.type === "publication.activate") {
    if (
      (await chrome.storage.local.get("publicationBackend"))
        .publicationBackend === "transactional"
    ) {
      return { status: "active" };
    }
    if (activation) {
      return activation;
    }
    const task = queue.then(() => activateRepository());
    queue = task.then(
      () => {},
      () => {}
    );
    activation = task.finally(() => {
      activation = undefined;
    });
    return activation;
  }
  if (request.type === "publication.legacyWrite") {
    const task = queue.then(async () => {
      if (
        (await chrome.storage.local.get("publicationBackend"))
          .publicationBackend === "transactional"
      ) {
        throw new Error(
          "Document storage changed. Refresh and retry this action."
        );
      }
      await applyLegacyMutation(request.command);
      return { status: "written" };
    });
    queue = task.then(
      () => {},
      () => {}
    );
    return task;
  }
  if (request.type === "publication.read") {
    return documentRepository.snapshot();
  }
  if (request.type === "publication.operationStatus") {
    if (typeof request.requestId !== "string") {
      throw new Error("Invalid operation ID.");
    }
    const state = await documentRepository.state();
    return {
      receipt: state.receipts[request.requestId] ?? null,
      effect: state.effects[request.requestId] ?? null,
    };
  }
  if (request.type === "publication.status") {
    const state = await documentRepository.state();
    const local = await chrome.storage.local.get([
      "publicationBackend",
      "verifiedSync",
      "publicationSyncStatus",
      "publicationCssStatus",
      "driveSyncEnabled",
    ]);
    return {
      ...local,
      pending: Object.keys(state.outbox).length,
      pendingStyles: Object.keys(state.cssOutbox ?? {}).length,
      conflicts: state.syncConflicts,
      generation: state.generation,
      current: Object.fromEntries(
        Object.values(state.documents).map((document) => [
          document.script.id,
          document.revision,
        ])
      ),
    };
  }
  if (request.type === "publication.enableVerifiedSync") {
    if (
      (await chrome.storage.local.get("publicationBackend"))
        .publicationBackend !== "transactional"
    ) {
      throw new Error("Activate local document storage first.");
    }
    await enableVerifiedReplication(documentRepository);
    return { status: "enabled" };
  }
  if (request.type === "publication.retrySync") {
    await ingestVerifiedSync(documentRepository);
    await flushSync(documentRepository);
    notifyPublication();
    void reconcilePendingCss(documentRepository).catch(console.error);
    return { status: "synced" };
  }
  if (request.type === "publication.resolve") {
    if (
      typeof request.id !== "string" ||
      typeof request.revision !== "string" ||
      !Number.isSafeInteger(request.generation)
    ) {
      throw new Error("Invalid conflict resolution.");
    }
    await documentRepository.update((state) => {
      if (state.generation !== request.generation) {
        throw new Error(
          "Saved data changed. Refresh the conflict before choosing a version."
        );
      }
      const local = state.documents[request.id];
      let selected =
        local?.revision === request.revision
          ? { id: request.id, ...local }
          : state.syncConflicts[request.id]?.find(
              (entry) => entry.revision === request.revision
            );
      if (!selected) {
        throw new Error(
          "This conflict has changed. Refresh before choosing a version."
        );
      }
      if (request.discard === true) {
        selected = { ...selected, script: undefined };
      }
      if (
        selected.script &&
        findDuplicateModulePathScript(
          Object.values(state.documents).map((document) => document.script),
          selected.script
        )
      ) {
        throw new Error(
          "Another saved script already uses this module alias. Rename it before keeping this version."
        );
      }
      const revision = crypto.randomUUID();
      const parents = [
        ...new Set(
          [
            ...(state.syncHeads[request.id] ?? []),
            selected.revision,
            state.documents[request.id]?.revision,
          ].filter(Boolean)
        ),
      ];
      if (selected.script) {
        delete state.tombstones[request.id];
        state.documents[request.id] = {
          script: selected.script,
          revision,
          parents,
        };
      } else {
        delete state.documents[request.id];
        state.tombstones[request.id] = { revision, parents };
      }
      state.cssOutbox ??= {};
      state.cssOutbox[request.id] = revision;
      delete state.artifacts[request.id];
      delete state.syncConflicts[request.id];
      state.syncRecords[revision] = { revision, parents };
      state.outbox[revision] = { ...selected, revision, parents };
      state.syncHeads[request.id] = [revision];
      state.generation++;
      captureDriveScript(state, request.id);
      return { state, value: undefined };
    });
    notifyPublication();
    void reconcilePendingCss(documentRepository).catch(console.error);
    void flushSync(documentRepository).catch(console.error);
    scheduleDriveSync();
    return { status: "resolved" };
  }
  if (
    request.type !== "publication.commit" ||
    !isPublicationCommand(request.command)
  ) {
    throw new Error("Invalid document command.");
  }
  const task = queue.then(async () => {
    const receipt = await documentRepository.readReceipt(
      request.command.requestId
    );
    if (receipt) {
      return receipt;
    }
    // Reject artifacts built for other source/settings before the short transaction.
    const snapshot = await documentRepository.snapshot();
    for (const write of request.command.writes) {
      if (!write.artifact) {
        continue;
      }
      const script =
        write.script ??
        snapshot.documents.find((item) => item.script.id === write.id)?.script;
      if (
        !script ||
        !isCompiledArtifactFresh(
          script,
          write.artifact,
          snapshot.settings.minifyCompiledOutput ?? false
        )
      ) {
        throw new Error(
          "Compiled output no longer matches the saved source or build settings."
        );
      }
      if (
        write.artifact.manifest &&
        write.artifact.manifest.source !== script.code.source.typescript
      ) {
        throw new Error("Module analysis no longer matches the source.");
      }
      if (
        write.artifact.build?.sourceDigest &&
        write.artifact.build.sourceDigest !==
          (await digestUserscriptCompileSources(script))
      ) {
        throw new Error("Compiled source digest does not match.");
      }
    }
    const result = await documentRepository.commit(request.command);
    if (result.status === "committed") {
      notifyPublication();
      void reconcilePendingCss(documentRepository).catch(console.error);
      void flushSync(documentRepository).catch(console.error);
      scheduleDriveSync();
    }
    return result;
  });
  queue = task.then(
    () => {},
    () => {}
  );
  return task;
}

async function activateRepository(): Promise<{ status: "active" }> {
  const tabs = await chrome.tabs.query({
    url: chrome.runtime.getURL("options.html"),
  });
  if (tabs.length > 1) {
    throw new Error(
      "Close other IDE tabs before activating local document storage."
    );
  }
  await chrome.storage.local.set({ publicationMigrating: true });
  try {
    await migrateLegacyDocuments(documentRepository, async () => {
      const [scripts, artifacts, modules, settings, raw] = await Promise.all([
        LegacyChromeSyncStorage.getAllScripts(),
        LegacyCompiledCodeStorage.getAllCompiledCode(),
        LegacyChromeSyncStorage.getAllModules(),
        LegacyChromeSyncStorage.getEditorSettings(),
        chrome.storage.sync.get(null),
      ]);
      for (const key of Object.keys(raw)) {
        if (
          key.startsWith("userscript:") &&
          !key.includes(":chunk:") &&
          !scripts[key.slice(11)]
        ) {
          throw new Error(
            "An unreadable or incomplete saved script must be recovered before migration: " +
              key
          );
        }
      }
      return { scripts, artifacts, modules, settings };
    });
    await chrome.storage.local.set({ publicationBackend: "transactional" });
    notifyPublication();
    void reconcilePendingCss(documentRepository).catch(console.error);
    void flushSync(documentRepository).catch(console.error);
    return { status: "active" };
  } finally {
    await chrome.storage.local.remove("publicationMigrating");
  }
}
