import { Typography } from "@/shared/components/typography/Typography";
import { useEffect, useState } from "react";

type StorageKeyUsage = {
  key: string;
  bytes: number;
};

type StorageUsageSnapshot = {
  syncTotalBytes: number;
  syncQuotaBytes: number;
  syncUserscriptBytes: number;
  syncUserscriptManifestCount: number;
  syncUserscriptChunkCount: number;
  syncOtherKeys: StorageKeyUsage[];
  localTotalBytes: number;
  localQuotaBytes: number;
  localCompiledBytes: number;
  localCompiledEntryCount: number;
  localOtherKeys: StorageKeyUsage[];
};

const USERSCRIPT_KEY_PREFIX = "userscript:";
const USERSCRIPT_CHUNK_SEPARATOR = ":chunk:";
const COMPILED_KEY_PREFIX = "compiled:";
const FALLBACK_SYNC_QUOTA_BYTES = 102400;
const FALLBACK_LOCAL_QUOTA_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${bytes} B`;
}

function formatPercent(bytes: number, quotaBytes: number): string {
  if (quotaBytes <= 0) {
    return "0.0%";
  }

  return `${((bytes / quotaBytes) * 100).toFixed(1)}%`;
}

function clampPercent(bytes: number, quotaBytes: number): number {
  if (quotaBytes <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (bytes / quotaBytes) * 100));
}

function isUserscriptManifestKey(key: string): boolean {
  return key.startsWith(USERSCRIPT_KEY_PREFIX) && !key.includes(USERSCRIPT_CHUNK_SEPARATOR);
}

function isUserscriptChunkKey(key: string): boolean {
  return key.startsWith(USERSCRIPT_KEY_PREFIX) && key.includes(USERSCRIPT_CHUNK_SEPARATOR);
}

function summarizeStorageKeys(
  keyUsage: StorageKeyUsage[],
  predicate: (key: string) => boolean
) {
  return keyUsage.filter((entry) => predicate(entry.key));
}

function prettifyStorageKey(key: string): string {
  switch (key) {
    case "globalModules":
      return "Global modules";
    case "globalState":
      return "Workspace layout";
    case "editorSettings":
      return "Editor settings";
    case "commandPaletteState":
      return "Command palette";
    default:
      return key;
  }
}

async function getBytesByKey(
  area: chrome.storage.StorageArea,
  keys: string[]
): Promise<StorageKeyUsage[]> {
  const usage = await Promise.all(
    keys.map(async (key) => ({
      key,
      bytes: await area.getBytesInUse(key),
    }))
  );

  return usage.sort((left, right) => right.bytes - left.bytes);
}

async function loadStorageUsageSnapshot(): Promise<StorageUsageSnapshot> {
  const syncArea = chrome.storage.sync as chrome.storage.StorageArea & {
    QUOTA_BYTES?: number;
  };
  const localArea = chrome.storage.local as chrome.storage.StorageArea & {
    QUOTA_BYTES?: number;
  };

  const [syncValues, localValues, syncTotalBytes, localTotalBytes] =
    await Promise.all([
      chrome.storage.sync.get(null),
      chrome.storage.local.get(null),
      chrome.storage.sync.getBytesInUse(null),
      chrome.storage.local.getBytesInUse(null),
    ]);

  const syncKeys = Object.keys(syncValues);
  const localKeys = Object.keys(localValues);
  const [syncKeyUsage, localKeyUsage] = await Promise.all([
    getBytesByKey(chrome.storage.sync, syncKeys),
    getBytesByKey(chrome.storage.local, localKeys),
  ]);

  const syncUserscriptEntries = summarizeStorageKeys(
    syncKeyUsage,
    (key) => key.startsWith(USERSCRIPT_KEY_PREFIX)
  );
  const syncUserscriptBytes = syncUserscriptEntries.reduce(
    (total, entry) => total + entry.bytes,
    0
  );
  const syncOtherKeys = summarizeStorageKeys(
    syncKeyUsage,
    (key) => !key.startsWith(USERSCRIPT_KEY_PREFIX)
  );

  const localCompiledEntries = summarizeStorageKeys(
    localKeyUsage,
    (key) => key.startsWith(COMPILED_KEY_PREFIX)
  );
  const localCompiledBytes = localCompiledEntries.reduce(
    (total, entry) => total + entry.bytes,
    0
  );
  const localOtherKeys = summarizeStorageKeys(
    localKeyUsage,
    (key) => !key.startsWith(COMPILED_KEY_PREFIX)
  );

  return {
    syncTotalBytes,
    syncQuotaBytes: syncArea.QUOTA_BYTES ?? FALLBACK_SYNC_QUOTA_BYTES,
    syncUserscriptBytes,
    syncUserscriptManifestCount: syncUserscriptEntries.filter((entry) =>
      isUserscriptManifestKey(entry.key)
    ).length,
    syncUserscriptChunkCount: syncUserscriptEntries.filter((entry) =>
      isUserscriptChunkKey(entry.key)
    ).length,
    syncOtherKeys,
    localTotalBytes,
    localQuotaBytes: localArea.QUOTA_BYTES ?? FALLBACK_LOCAL_QUOTA_BYTES,
    localCompiledBytes,
    localCompiledEntryCount: localCompiledEntries.length,
    localOtherKeys,
  };
}

type MeterProps = {
  label: string;
  bytes: number;
  quotaBytes: number;
  toneClassName: string;
  description: string;
};

function StorageMeter({
  label,
  bytes,
  quotaBytes,
  toneClassName,
  description,
}: MeterProps) {
  const percent = clampPercent(bytes, quotaBytes);
  const barWidth = percent > 0 ? Math.max(percent, 2) : 0;

  return (
    <div className="rounded-default border border-border-subtle bg-surface-base p-md">
      <div className="mb-2 flex items-end justify-between gap-sm">
        <div>
          <Typography variant="code" className="text-sm text-foreground">
            {label}
          </Typography>
          <Typography variant="caption" className="mt-1 block text-text-muted">
            {description}
          </Typography>
        </div>
        <Typography variant="code" className="text-right text-sm text-foreground">
          {formatBytes(bytes)}
        </Typography>
      </div>

      <div className="h-2 overflow-hidden rounded-default bg-surface-overlay">
        <div
          className={`h-full rounded-default transition-[width] duration-200 ${toneClassName}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-sm">
        <Typography variant="caption" className="text-text-muted-strong">
          {formatPercent(bytes, quotaBytes)} of {formatBytes(quotaBytes)}
        </Typography>
        <Typography variant="caption" className="text-text-muted-strong">
          {formatBytes(Math.max(0, quotaBytes - bytes))} free
        </Typography>
      </div>
    </div>
  );
}

export function StorageUsagePanel() {
  const [snapshot, setSnapshot] = useState<StorageUsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const readUsage = async () => {
      try {
        const nextSnapshot = await loadStorageUsageSnapshot();

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load storage usage."
          );
        }
      }
    };

    void readUsage();

    const handleStorageChanged = (
      _changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "sync" || areaName === "local") {
        void readUsage();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, []);

  if (error) {
    return (
      <Typography variant="code" className="text-error">
        {error}
      </Typography>
    );
  }

  if (!snapshot) {
    return (
      <Typography variant="code" className="text-text-muted">
        Inspecting chrome storage usage...
      </Typography>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="grid gap-sm xl:grid-cols-2">
        <StorageMeter
          label="chrome.storage.sync"
          bytes={snapshot.syncTotalBytes}
          quotaBytes={snapshot.syncQuotaBytes}
          toneClassName="bg-accent"
          description="Source code, userscript metadata, modules, settings, and layout state."
        />
        <StorageMeter
          label="chrome.storage.local"
          bytes={snapshot.localTotalBytes}
          quotaBytes={snapshot.localQuotaBytes}
          toneClassName="bg-syntax-param"
          description="Compiled JavaScript and CSS artifacts plus any future local-only data."
        />
      </div>

      <div className="grid gap-sm xl:grid-cols-2">
        <div className="rounded-default border border-border-subtle bg-surface-base p-md">
          <Typography variant="section-title" className="mb-3 text-text-muted-strong">
            Sync Breakdown
          </Typography>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-sm">
              <Typography variant="body">Userscript source payloads</Typography>
              <Typography variant="code">{formatBytes(snapshot.syncUserscriptBytes)}</Typography>
            </div>
            <Typography variant="caption" className="text-text-muted-strong">
              {snapshot.syncUserscriptManifestCount} manifests, {snapshot.syncUserscriptChunkCount} overflow chunks
            </Typography>
            <div className="mt-1 flex items-center justify-between gap-sm border-t border-border-subtle pt-2.5">
              <Typography variant="body">Other sync keys</Typography>
              <Typography variant="code">
                {formatBytes(snapshot.syncTotalBytes - snapshot.syncUserscriptBytes)}
              </Typography>
            </div>
            {snapshot.syncOtherKeys.slice(0, 4).map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-sm text-xs"
              >
                <Typography variant="caption" className="text-text-muted">
                  {prettifyStorageKey(entry.key)}
                </Typography>
                <Typography variant="code" className="text-xs text-foreground">
                  {formatBytes(entry.bytes)}
                </Typography>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-default border border-border-subtle bg-surface-base p-md">
          <Typography variant="section-title" className="mb-3 text-text-muted-strong">
            Local Breakdown
          </Typography>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-sm">
              <Typography variant="body">Compiled output entries</Typography>
              <Typography variant="code">{formatBytes(snapshot.localCompiledBytes)}</Typography>
            </div>
            <Typography variant="caption" className="text-text-muted-strong">
              {snapshot.localCompiledEntryCount} compiled userscript records
            </Typography>
            <div className="mt-1 flex items-center justify-between gap-sm border-t border-border-subtle pt-2.5">
              <Typography variant="body">Other local keys</Typography>
              <Typography variant="code">
                {formatBytes(snapshot.localTotalBytes - snapshot.localCompiledBytes)}
              </Typography>
            </div>
            {snapshot.localOtherKeys.length > 0 ? (
              snapshot.localOtherKeys.slice(0, 4).map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-sm text-xs"
                >
                  <Typography variant="caption" className="text-text-muted">
                    {prettifyStorageKey(entry.key)}
                  </Typography>
                  <Typography variant="code" className="text-xs text-foreground">
                    {formatBytes(entry.bytes)}
                  </Typography>
                </div>
              ))
            ) : (
              <Typography variant="caption" className="text-text-muted">
                No additional local-storage buckets detected.
              </Typography>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}