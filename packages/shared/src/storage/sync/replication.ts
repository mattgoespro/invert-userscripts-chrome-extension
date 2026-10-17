export interface CausalRevision {
  revision: string;
  parents: string[];
}
export function mergeSyncRevision(
  heads: string[],
  incoming: CausalRevision,
  revisions: Record<string, CausalRevision>
): { status: "advance" | "duplicate" | "conflict"; heads: string[] } {
  const records = { ...revisions, [incoming.revision]: incoming };
  const descends = (
    child: string,
    ancestor: string,
    seen = new Set<string>()
  ): boolean => {
    if (child === ancestor) {
      return true;
    }
    if (seen.has(child)) {
      return false;
    }
    seen.add(child);
    return (records[child]?.parents ?? []).some((parent) =>
      descends(parent, ancestor, seen)
    );
  };
  const candidates = [...new Set([...heads, incoming.revision])];
  const normalized = candidates.filter(
    (head) =>
      !candidates.some((other) => other !== head && descends(other, head))
  );
  const unchanged =
    normalized.length === heads.length &&
    normalized.every((head) => heads.includes(head));
  return {
    status: unchanged
      ? "duplicate"
      : normalized.length > 1
        ? "conflict"
        : "advance",
    heads: normalized,
  };
}
