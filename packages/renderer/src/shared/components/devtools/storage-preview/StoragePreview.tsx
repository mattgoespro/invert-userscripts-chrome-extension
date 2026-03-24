import { useCallback, useEffect, useState } from "react";

export function StoragePreview() {
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});

  const fetchStorage = useCallback(async () => {
    try {
      const data = await chrome.storage.sync.get(null);
      setStorageData(data);
    } catch (error) {
      console.error(
        "StoragePreview: Failed to read chrome.storage.sync",
        error
      );
    }
  }, []);

  useEffect(() => {
    fetchStorage();

    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "sync") {
        setStorageData((prev) => {
          const updated = { ...prev };
          for (const [key, change] of Object.entries(changes)) {
            if (change.newValue !== undefined) {
              updated[key] = change.newValue;
            } else {
              delete updated[key];
            }
          }
          return updated;
        });
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, [fetchStorage]);

  return (
    <pre className="text-text-muted m-0 px-3.5 py-3 font-mono text-[11px] leading-[1.6] whitespace-pre">
      {JSON.stringify(storageData, null, 2)}
    </pre>
  );
}
