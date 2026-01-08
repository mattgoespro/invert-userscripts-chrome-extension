type RuntimePortMessagePayloads = {
  refreshTabs: never;
};

export type RuntimePortMessageName = keyof RuntimePortMessagePayloads;

const RuntimePortMessageSources = ["background", "options", "popup", "content-script"] as const;

export type RuntimePortMessageSource = (typeof RuntimePortMessageSources)[number];

export type RuntimePortMessageEvent<T extends RuntimePortMessageName = RuntimePortMessageName> =
  RuntimePortMessagePayloads[T] extends never
    ? {
        source: RuntimePortMessageSource;
        type: T;
      }
    : { source: RuntimePortMessageSource; type: T; data: RuntimePortMessagePayloads[T] };

export function isRuntimePort(name: string): name is RuntimePortMessageSource {
  return RuntimePortMessageSources.includes(name as RuntimePortMessageSource);
}
