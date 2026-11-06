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
  // Iterative: revision histories can outgrow the call stack.
  const descends = (child: string, ancestor: string): boolean => {
    const seen = new Set<string>();
    const stack = [child];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === ancestor) {
        return true;
      }
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      stack.push(...(records[current]?.parents ?? []));
    }
    return false;
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
