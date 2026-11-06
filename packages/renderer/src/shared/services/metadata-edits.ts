import type { Userscript } from "@shared/model";

/** An updater computes its edit from the latest stored script at publish time. */
export type MetadataUpdates =
  | Partial<Userscript>
  | ((latest: Userscript) => Partial<Userscript>);

export function resolveMetadataUpdates(
  updates: MetadataUpdates,
  latest: Userscript
): Partial<Userscript> {
  return typeof updates === "function" ? updates(latest) : updates;
}

export function toggleListItem(
  list: string[],
  item: string,
  selected: boolean
): string[] {
  const without = list.filter((existing) => existing !== item);
  return selected ? [...without, item] : without;
}

/** Apply the difference between `base` and `next` to the latest stored list. */
export function rebaseList(
  base: string[],
  next: string[],
  latest: string[]
): string[] {
  const kept = latest.filter(
    (item) => next.includes(item) || !base.includes(item)
  );
  const added = next.filter(
    (item, index) =>
      !base.includes(item) &&
      !kept.includes(item) &&
      next.indexOf(item) === index
  );
  return [...kept, ...added];
}

type ListField = "urlPatterns" | "globalModules";
const LIST_FIELDS: ListField[] = ["urlPatterns", "globalModules"];

/** Turn whole lists computed from `rendered` into edits of the latest lists. */
export function rebaseListUpdates(
  rendered: Partial<Pick<Userscript, ListField>>,
  updates: Partial<Userscript>
): MetadataUpdates {
  if (!LIST_FIELDS.some((field) => updates[field] !== undefined)) {
    return updates;
  }

  return (latest) => {
    const rebased = { ...updates };
    for (const field of LIST_FIELDS) {
      if (updates[field] !== undefined) {
        rebased[field] = rebaseList(
          rendered[field] ?? [],
          updates[field],
          latest[field] ?? []
        );
      }
    }
    return rebased;
  };
}

export interface KeyedDebouncer<T> {
  schedule(key: string, value: T): void;
  cancel(key: string): void;
  /** Publish every pending value now. The debouncer stays usable. */
  flush(): void;
}

/** One pending value per key, so edits to one key never drop another's. */
export function createKeyedDebouncer<T>(
  publish: (key: string, value: T) => void,
  delayMs: number
): KeyedDebouncer<T> {
  const pending = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; value: T }
  >();

  const cancel = (key: string): void => {
    const entry = pending.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(key);
    }
  };

  return {
    schedule(key: string, value: T): void {
      cancel(key);
      const timer = setTimeout(() => {
        pending.delete(key);
        publish(key, value);
      }, delayMs);
      pending.set(key, { timer, value });
    },
    cancel,
    flush(): void {
      for (const [key, { value }] of [...pending]) {
        cancel(key);
        publish(key, value);
      }
    },
  };
}
