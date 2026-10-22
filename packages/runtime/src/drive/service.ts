import type { StoredRepositoryState } from "@shared/storage/document-repository";
import {
  mergeDriveRecords,
  type DrivePhase,
  type DriveRecord,
  type DriveStatus,
} from "@shared/storage/drive-sync";
import { DriveAuthError, type DriveTransport } from "./transport";

export interface DriveRepository {
  state(): Promise<StoredRepositoryState>;
  update<T>(
    transform: (state: StoredRepositoryState) => {
      state: StoredRepositoryState;
      value: T;
    }
  ): Promise<T>;
}
interface DriveServiceOptions {
  repository: DriveRepository;
  configured(): boolean;
  prepare(): Promise<void>;
  authorize(
    interactive: boolean,
    signal: AbortSignal
  ): Promise<{
    accountId: string;
    accountLabel: string;
    transport: DriveTransport;
  }>;
  writeStatus(status: DriveStatus): Promise<void>;
  readStatus(): Promise<DriveStatus | undefined>;
  clearAuthorization(): Promise<void>;
  retry(): Promise<void>;
  notify(): void;
}
export class DriveSyncService {
  private running?: Promise<void>;
  private abort?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private options: DriveServiceOptions) {}
  async status(): Promise<DriveStatus> {
    const state = await this.options.repository.state();
    const previous = await this.options.readStatus();
    const phase = !this.options.configured()
      ? "setup-required"
      : previous?.phase === "setup-required"
        ? "connect-required"
        : (previous?.phase ?? "connect-required");
    const effective = state.drive?.paused
      ? "disconnected"
      : state.drive?.authorizationRequired && phase !== "account-mismatch"
        ? "reconnect-required"
        : phase === "synced" && state.drive?.pending.length
          ? "pending"
          : phase;
    return this.describe(
      state,
      effective,
      effective === previous?.phase ? previous.message : undefined
    );
  }
  private describe(
    state: StoredRepositoryState,
    phase: DrivePhase,
    message?: string
  ): DriveStatus {
    const conflicts: DriveStatus["conflicts"] = {};
    for (const kind of ["settings", "modules", "layout"] as const) {
      const heads = state.drive?.heads[kind] ?? [];
      if (heads.length > 1) {
        conflicts[kind] = heads.map(
          (revision) => state.drive!.records[revision]
        );
      }
    }
    const messages: Record<DrivePhase, string> = {
      disconnected:
        "Google Drive is disconnected. Changes stay on this device until you connect again.",
      "setup-required": "Google Drive sync needs OAuth setup in this build.",
      "connect-required":
        "Connect Google Drive to protect your scripts, settings and layout across reinstalls.",
      "reconnect-required":
        "Reconnect your Google account. Changes remain saved on this device.",
      "account-mismatch":
        "This workspace belongs to a different Google account. Reconnect the original account; pending changes have not been uploaded.",
      restoring: "Restoring and checking your Google Drive data…",
      syncing: "Uploading changes to Google Drive…",
      offline:
        "Offline — changes are saved on this device and will upload automatically after reconnecting.",
      pending: "Changes are saved on this device and waiting to upload.",
      conflict:
        "Sync has conflicting versions. Choose which version to keep in Settings.",
      synced: "Synced to Google Drive.",
      error:
        "Drive sync needs attention. Your local changes have been retained.",
    };
    return {
      connected:
        !!state.drive?.accountId &&
        !state.drive.paused &&
        !state.drive.authorizationRequired &&
        ![
          "setup-required",
          "connect-required",
          "reconnect-required",
          "account-mismatch",
          "disconnected",
        ].includes(phase),
      phase,
      message: message ?? messages[phase],
      pending: state.drive?.pending.length ?? 0,
      accountLabel: state.drive?.accountLabel,
      lastSyncedAt: state.drive?.syncedAt,
      conflicts,
      current: {
        settings: state.settingsRevision ?? undefined,
        modules: state.moduleRevision ?? undefined,
        layout: state.drive?.layoutRevision,
      },
      generation: state.generation,
    };
  }
  private async report(phase: DrivePhase, message?: string): Promise<void> {
    const state = await this.options.repository.state();
    await this.options.writeStatus(
      this.describe(
        state,
        state.drive?.paused ? "disconnected" : phase,
        state.drive?.paused ? undefined : message
      )
    );
  }
  async disconnect(): Promise<void> {
    this.abort?.abort();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    // Keep account ownership and the outbox. Disconnect is local to this
    // installation and must survive worker restarts without deleting cloud data.
    await this.options.repository.update((state) => {
      if (state.drive) {
        state.drive.paused = true;
      }
      return { state, value: undefined };
    });
    await this.running;
    await this.options.clearAuthorization();
    await this.report("disconnected");
  }
  schedule(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    void this.report("pending").catch(console.error);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.run().catch(console.error);
    }, 350);
  }
  invalidate(): void {
    this.abort?.abort();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    void this.options.repository
      .update((state) => {
        if (state.drive) {
          state.drive.authorizationRequired = true;
        }
        return { state, value: undefined };
      })
      .then(() => this.report("reconnect-required"))
      .catch(console.error);
  }
  async run(interactive = false, downloadOnly = false): Promise<void> {
    if (this.running) {
      await this.running;
      if (interactive || downloadOnly) {
        return this.run(interactive, downloadOnly);
      }
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.running = this.synchronize(interactive, downloadOnly).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async synchronize(
    interactive: boolean,
    downloadOnly: boolean
  ): Promise<void> {
    if (!this.options.configured()) {
      await this.report("setup-required");
      return;
    }
    const controller = new AbortController();
    this.abort = controller;
    try {
      await this.options.prepare();
      if (interactive) {
        await this.options.repository.update((state) => {
          delete state.drive!.paused;
          return { state, value: undefined };
        });
      } else if ((await this.options.repository.state()).drive?.paused) {
        await this.report("disconnected");
        return;
      }
      controller.signal.throwIfAborted();
      const session = await this.options.authorize(
        interactive,
        controller.signal
      );
      controller.signal.throwIfAborted();
      const state = await this.options.repository.state();
      if (
        state.drive?.accountId &&
        state.drive.accountId !== session.accountId
      ) {
        await this.options.repository.update((current) => {
          current.drive!.authorizationRequired = true;
          return { state: current, value: undefined };
        });
        await this.report("account-mismatch");
        return;
      }
      const needsAdoption =
        !interactive &&
        (!!state.drive?.adoptionRequired ||
          (!state.drive?.accountId && !!state.drive?.pending.length));
      await this.options.repository.update((current) => {
        if (!current.drive) {
          throw new Error("Local Drive storage was not initialized.");
        }
        // Downloaded private data is account-owned even while preexisting local
        // uploads await confirmation. Ownership and upload adoption are distinct.
        current.drive.accountId = session.accountId;
        current.drive.accountLabel = session.accountLabel;
        delete current.drive.authorizationRequired;
        current.drive.adoptionRequired = needsAdoption;
        return { state: current, value: undefined };
      });
      await this.report("restoring");
      // Do not publish anything until the entire paginated remote discovery validates.
      const incoming: DriveRecord[] = [];
      const downloaded = new Set(state.drive?.downloaded ?? []);
      const discovered = await session.transport.list();
      for (const id of discovered) {
        controller.signal.throwIfAborted();
        if (downloaded.has(id)) {
          continue;
        }
        incoming.push(...(await session.transport.download(id)));
      }
      controller.signal.throwIfAborted();
      const changed = await this.options.repository.update((current) => {
        const changed = mergeDriveRecords(current, incoming);
        current.drive!.downloaded = [
          ...new Set([...(current.drive!.downloaded ?? []), ...discovered]),
        ];
        current.drive!.restoredAt = Date.now();
        return { state: current, value: changed };
      });
      if (changed) {
        this.options.notify();
      }
      if (needsAdoption) {
        await this.report("connect-required");
        return;
      }
      for (; !downloadOnly; ) {
        controller.signal.throwIfAborted();
        let current = await this.options.repository.state();
        if (!current.drive!.upload && !current.drive!.pending.length) {
          break;
        }
        await this.report("syncing");
        if (!current.drive!.upload) {
          const fileId = await session.transport.generateId();
          controller.signal.throwIfAborted();
          await this.options.repository.update((next) => {
            next.drive!.upload ??= {
              fileId,
              revisions: next.drive!.pending.slice(0, 50),
            };
            return { state: next, value: undefined };
          });
          current = await this.options.repository.state();
        }
        const upload = current.drive!.upload!;
        const records = upload.revisions.map(
          (revision) => current.drive!.records[revision]
        );
        await session.transport.upload(upload.fileId, records);
        controller.signal.throwIfAborted();
        await this.options.repository.update((next) => {
          if (
            next.drive!.accountId !== session.accountId ||
            next.drive!.upload?.fileId !== upload.fileId
          ) {
            throw new Error("The sync workspace changed during upload.");
          }
          next.drive!.pending = next.drive!.pending.filter(
            (revision) => !upload.revisions.includes(revision)
          );
          delete next.drive!.upload;
          next.drive!.downloaded = [
            ...new Set([...(next.drive!.downloaded ?? []), upload.fileId]),
          ];
          for (const revision of upload.revisions) {
            delete next.outbox[revision];
            for (const kind of ["settings", "modules"] as const) {
              if (next.preferenceOutbox[kind] === revision) {
                delete next.preferenceOutbox[kind];
              }
            }
          }
          return { state: next, value: undefined };
        });
      }
      await this.options.repository.update((current) => {
        if (!current.drive!.pending.length) {
          current.drive!.syncedAt = Date.now();
        }
        return { state: current, value: undefined };
      });
      const latest = await this.options.repository.state();
      const conflicted =
        Object.values(latest.syncConflicts).some((items) => items.length) ||
        Object.values(latest.drive!.heads).some((heads) => heads.length > 1);
      await this.report(
        latest.drive!.pending.length
          ? "pending"
          : conflicted
            ? "conflict"
            : "synced"
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      if (error instanceof DriveAuthError) {
        await this.options.repository.update((state) => {
          if (state.drive) {
            state.drive.authorizationRequired = true;
          }
          return { state, value: undefined };
        });
      }
      const offline =
        error instanceof TypeError ||
        (error instanceof DOMException &&
          ["NetworkError", "TimeoutError"].includes(error.name));
      await this.report(
        error instanceof DriveAuthError
          ? "reconnect-required"
          : offline
            ? "offline"
            : "error",
        offline || error instanceof DriveAuthError
          ? undefined
          : error instanceof Error
            ? error.message
            : "Drive sync failed. Your changes remain saved locally."
      );
    } finally {
      if (this.abort === controller) {
        this.abort = undefined;
      }
      if (!(await this.options.repository.state()).drive?.paused) {
        await this.options.retry();
      }
    }
  }
}
