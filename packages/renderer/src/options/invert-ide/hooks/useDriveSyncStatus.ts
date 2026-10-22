import { useEffect, useState } from "react";
import { repositoryRequest } from "@shared/publication/client";
import type { DriveStatus } from "@shared/storage/drive-sync";

export function useDriveSyncStatus(): DriveStatus | undefined {
  const [status, setStatus] = useState<DriveStatus>();
  useEffect(() => {
    let disposed = false;
    let sequence = 0;
    const refresh = (): void => {
      const request = ++sequence;
      void repositoryRequest<DriveStatus>({ type: "publication.drive.status" })
        .then((value) => {
          if (!disposed && request === sequence) {
            setStatus(value);
          }
        })
        .catch((error) =>
          console.error("Could not read Drive sync status:", error)
        );
    };
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ): void => {
      if (area === "local" && changes.driveSyncStatus) {
        refresh();
      }
    };
    refresh();
    chrome.storage.onChanged.addListener(changed);
    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  return status;
}
