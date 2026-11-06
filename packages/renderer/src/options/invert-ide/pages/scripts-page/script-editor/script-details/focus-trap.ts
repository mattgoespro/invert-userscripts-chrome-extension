/**
 * Where Tab has to send focus to stay inside a modal surface, or null when the
 * browser's own order already stays inside it. Focus on the surface itself, or
 * nowhere in the list, counts as the start of the cycle.
 */
export function getFocusWrapTarget<T>(
  tabbable: readonly T[],
  active: unknown,
  backwards: boolean
): T | null {
  if (tabbable.length === 0) {
    return null;
  }
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const index = tabbable.indexOf(active as T);
  if (backwards) {
    return index <= 0 ? last : null;
  }
  return index === -1 || active === last ? first : null;
}
