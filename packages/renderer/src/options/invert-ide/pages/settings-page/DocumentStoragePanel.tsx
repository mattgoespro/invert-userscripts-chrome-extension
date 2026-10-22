import { useEffect, useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { repositoryRequest } from "@shared/publication/client";
import { DriveSyncPanel } from "./drive-sync-panel/DriveSyncPanel";
interface StorageStatus {
  driveSyncEnabled?: boolean;
  pendingStyles?: number;
  publicationCssStatus?: { status: string; message?: string };
  publicationBackend?: string;
  verifiedSync?: boolean;
  pending: number;
  generation: number;
  publicationSyncStatus?: { status: string; message?: string };
  conflicts: Record<
    string,
    Array<{
      id: string;
      revision: string;
      script?: { name: string };
      conflictReason?: string;
    }>
  >;
  current?: Record<string, string>;
}
export function DocumentStoragePanel() {
  const [status, setStatus] = useState<StorageStatus>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () =>
    setStatus(
      await repositoryRequest<StorageStatus>({ type: "publication.status" })
    );
  useEffect(() => {
    void refresh().catch((error) => setError(String(error)));
    const changed = () => {
      void refresh().catch((error) => setError(String(error)));
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, []);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-sm text-sm text-text-muted-strong">
      <DriveSyncPanel />
      {!status?.driveSyncEnabled && (
        <p>
          Saved scripts continue syncing between browsers. Local document
          storage lets saving succeed while sync is unavailable.
        </p>
      )}
      {status?.publicationBackend !== "transactional" ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() => repositoryRequest({ type: "publication.activate" }))
          }
        >
          Enable local document storage
        </Button>
      ) : (
        <>
          {!status.driveSyncEnabled && (
            <>
              <p>
                Local document storage active. {status.pending} revision(s)
                waiting to sync.
              </p>
              {Boolean(status.pendingStyles) && (
                <p>
                  {status.pendingStyles} stylesheet update(s) pending.{" "}
                  {status.publicationCssStatus?.message}
                </p>
              )}
              <p>
                {status.publicationSyncStatus?.message ??
                  status.publicationSyncStatus?.status ??
                  "Sync is ready."}
              </p>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() =>
                  void run(() =>
                    repositoryRequest({ type: "publication.retrySync" })
                  )
                }
              >
                Retry sync
              </Button>
              {!status.verifiedSync && (
                <>
                  <p>
                    Enable verified sync after updating this extension on every
                    browser you sync with. Older extension versions cannot write
                    the new revision format safely.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        repositoryRequest({
                          type: "publication.enableVerifiedSync",
                        })
                      )
                    }
                  >
                    All my browsers are updated — enable verified sync
                  </Button>
                </>
              )}
            </>
          )}
          {Object.entries(status.conflicts ?? {}).map(([id, versions]) => (
            <div key={id}>
              <p>Sync conflict for {id}. Choose the saved version to keep.</p>
              {status.current?.[id] && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      repositoryRequest({
                        type: "publication.resolve",
                        id,
                        revision: status.current[id],
                        generation: status.generation,
                      })
                    )
                  }
                >
                  Keep this browser’s version
                </Button>
              )}
              {versions.map((version) => (
                <span key={version.revision}>
                  {version.conflictReason && <p>{version.conflictReason}</p>}
                  <Button
                    disabled={busy}
                    variant="secondary"
                    onClick={() =>
                      void run(() =>
                        repositoryRequest({
                          type: "publication.resolve",
                          id,
                          revision: version.revision,
                          generation: status.generation,
                        })
                      )
                    }
                  >
                    Use {version.script?.name ?? "deleted version"} (
                    {version.revision.slice(0, 8)})
                  </Button>
                  {!status.current?.[id] && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          repositoryRequest({
                            type: "publication.resolve",
                            id,
                            revision: version.revision,
                            generation: status.generation,
                            discard: true,
                          })
                        )
                      }
                    >
                      Discard incoming script
                    </Button>
                  )}
                </span>
              ))}
            </div>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="text-error-accent">
          {error}
        </p>
      )}
    </div>
  );
}
