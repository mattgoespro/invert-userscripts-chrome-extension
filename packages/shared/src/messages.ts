type RuntimePortMessagePayloads = {
  /**
   * @deprecated Prefer `applyScripts` with explicit script IDs.
   * Kept as a thin wrapper that applies all scripts to matching tabs only.
   */
  refreshTabs: never;
  /** Re-inject the given scripts (and shared-module consumers) into matching open tabs. */
  applyScripts: { scriptIds: string[]; requestId?: string };
  /** Apply or tear down a script on matching open tabs after an enable/disable change. */
  setEnabled: { scriptId: string; enabled: boolean; requestId?: string };
};

export type RuntimePortMessageName = keyof RuntimePortMessagePayloads;

const RuntimePortMessageSources = ["background", "options", "popup"] as const;

export type RuntimePortMessageSource =
  (typeof RuntimePortMessageSources)[number];

type RuntimePortMessageByName<T extends RuntimePortMessageName> =
  RuntimePortMessagePayloads[T] extends never
    ? {
        source: RuntimePortMessageSource;
        type: T;
      }
    : {
        source: RuntimePortMessageSource;
        type: T;
        data: RuntimePortMessagePayloads[T];
      };

export type RuntimePortMessageEvent<
  T extends RuntimePortMessageName = RuntimePortMessageName,
> = {
  [K in T]: RuntimePortMessageByName<K>;
}[T];

export type ApplyScriptsResponse = {
  status?: "unknown";
  message?: string;
  success: boolean;
  appliedTabCount: number;
  removedTabCount?: number;
  /** Tabs that matched but were skipped because compiled output was stale. */
  staleSkipCount?: number;
};

export function isRuntimePort(name: string): name is RuntimePortMessageSource {
  return RuntimePortMessageSources.some((source) => source === name);
}
