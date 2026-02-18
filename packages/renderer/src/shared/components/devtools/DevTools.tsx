import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeSwitcher } from "@/shared/components/theme-switcher/ThemeSwitcher";
import "./DevTools.scss";

export function DevTools() {
  const [expanded, setExpanded] = useState(false);
  const [storageData, setStorageData] = useState<Record<string, unknown>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchStorage = useCallback(async () => {
    try {
      const data = await chrome.storage.sync.get(null);
      setStorageData(data);
    } catch (error) {
      console.error("AppDevTools: Failed to read chrome.storage.sync", error);
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
    <div className="app-dev-tools">
      <ThemeSwitcher />

      <div className="app-dev-tools--storage" onBlur={() => setExpanded(false)}>
        <button
          className="app-dev-tools--toggle"
          onClick={() => setExpanded((prev) => !prev)}
          title="Storage Inspector (devtool)"
        >
          <span className="app-dev-tools--toggle-icon">{expanded ? "▾" : "▸"}</span>
          <span className="app-dev-tools--toggle-label">chrome.storage.sync</span>
        </button>

        {expanded && (
          <div className="app-dev-tools--panel" ref={panelRef}>
            <div className="app-dev-tools--panel-header">
              <span className="app-dev-tools--panel-prefix">{"// "}</span>
              devtools: storage inspector
            </div>
            <pre className="app-dev-tools--json">{JSON.stringify(storageData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
