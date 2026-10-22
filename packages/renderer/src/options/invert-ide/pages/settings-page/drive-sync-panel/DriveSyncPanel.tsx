import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/shared/components/button/Button";
import {
  repositoryRequest,
  type RepositoryRequest,
} from "@shared/publication/client";
import { useDriveSyncStatus } from "../../../hooks/useDriveSyncStatus";
import type { DrivePreference } from "@shared/storage/drive-sync";

export function DriveSyncPanel({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const status = useDriveSyncStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (request: RepositoryRequest): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      await repositoryRequest(request);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const setup = status?.phase === "setup-required";
  const connected = status?.connected ?? false;
  return (
    <div
      {...rest}
      data-testid="drive-sync-panel"
      aria-busy={busy}
      className={clsx(
        "flex flex-col gap-sm rounded-default border border-border p-md text-sm text-text-muted-strong",
        className
      )}
    >
      <p className="font-medium text-foreground">
        Persistent Google Drive sync
      </p>
      <p role="status" aria-live="polite">
        {status?.message ?? "Checking Drive sync…"}
      </p>
      {status?.accountLabel && <p>Account: {status.accountLabel}</p>}
      {!!status?.pending && (
        <p>
          {status.pending} change(s) waiting to upload. These changes are only
          on this device until synced.
        </p>
      )}
      {status?.lastSyncedAt && (
        <p>
          Last confirmed sync: {new Date(status.lastSyncedAt).toLocaleString()}
        </p>
      )}
      {setup && (
        <p>
          Set clientId in config/google-drive.json, then rebuild. Invert’s
          stable extension key is already included. See{" "}
          <a
            className="underline"
            href="https://developer.chrome.com/docs/extensions/how-to/integrate/oauth"
            target="_blank"
            rel="noreferrer"
          >
            Google’s extension OAuth setup
          </a>{" "}
          and the repository’s Drive sync setup guide.
        </p>
      )}
      <div className="flex flex-wrap gap-sm">
        <Button
          disabled={busy || !status || setup}
          onClick={() =>
            void run({
              type: connected
                ? "publication.drive.disconnect"
                : "publication.drive.connect",
            })
          }
        >
          {connected ? "Disconnect" : "Connect"}
        </Button>
        {connected && (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run({ type: "publication.drive.sync" })}
            >
              Upload now
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run({ type: "publication.drive.download" })}
            >
              Download from Drive
            </Button>
          </>
        )}
      </div>
      <p>
        Scripts, modules, settings and UI layout upload automatically. Downloads
        preserve pending local edits and conflicting versions. Before
        uninstalling, wait for “Synced to Google Drive”.
      </p>
      {status &&
        Object.entries(status.conflicts).map(([kind, versions]) => (
          <div
            className="flex flex-col gap-sm border-t border-border pt-sm"
            key={kind}
          >
            <p>Conflicting {kind} versions. Choose the value to keep:</p>
            {versions.map((record) => (
              <div key={record.revision} className="flex flex-col gap-sm">
                {"value" in record && (
                  <pre className="max-h-32 overflow-auto text-xs whitespace-pre-wrap">
                    {JSON.stringify(record.value, null, 2)}
                  </pre>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      type: "publication.drive.resolve",
                      kind: kind as DrivePreference,
                      revision: record.revision,
                      generation: status.generation,
                    })
                  }
                >
                  {status.current[kind as DrivePreference] === record.revision
                    ? "Keep this browser’s value"
                    : "Use this downloaded value"}
                </Button>
              </div>
            ))}
          </div>
        ))}
      {error && (
        <p role="alert" className="text-error-accent">
          {error}
        </p>
      )}
    </div>
  );
}
