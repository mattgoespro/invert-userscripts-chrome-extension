export type ConflictDialogCloseAction = "ignore" | "dismiss" | "keep-all-local";

/**
 * Closing keeps all local drafts by saving them. After a failed save, closing
 * must not retry the failing action: it leaves the conflict unresolved instead.
 */
export function getConflictDialogCloseAction(
  isPersisting: boolean,
  persistError: string | null
): ConflictDialogCloseAction {
  if (isPersisting) {
    return "ignore";
  }
  return persistError === null ? "keep-all-local" : "dismiss";
}

/** A dismissed conflict stays pending; a newly observed one reopens the dialog. */
export function isConflictDialogOpen(
  conflictIds: string[],
  dismissedIds: ReadonlySet<string>
): boolean {
  return conflictIds.some((conflictId) => !dismissedIds.has(conflictId));
}

export function getPersistErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return "The save failed for an unknown reason.";
}
