import type {
  PreparedMutation,
  RepositorySnapshot,
  CommitOutcome,
} from "./contracts";
export type RepositoryRequest =
  | { type: "publication.drive.status" }
  | { type: "publication.drive.connect" }
  | { type: "publication.drive.disconnect" }
  | { type: "publication.drive.sync" }
  | { type: "publication.drive.download" }
  | { type: "publication.drive.layout.read" }
  | {
      type: "publication.drive.layout.write";
      value: import("../storage/global-state.storage").GlobalState;
    }
  | {
      type: "publication.drive.resolve";
      kind: import("../storage/drive-sync").DrivePreference;
      revision: string;
      generation: number;
    }
  | {
      type: "publication.legacyWrite";
      command: import("./legacy-mutation").LegacyMutation;
    }
  | { type: "publication.read" }
  | { type: "publication.commit"; command: PreparedMutation }
  | { type: "publication.activate" }
  | { type: "publication.status" }
  | { type: "publication.operationStatus"; requestId: string }
  | {
      type: "publication.resolve";
      id: string;
      revision: string;
      generation: number;
      discard?: boolean;
    }
  | { type: "publication.enableVerifiedSync" }
  | { type: "publication.retrySync" };
type Transport = (request: RepositoryRequest) => Promise<unknown>;
let internalTransport: Transport | undefined;
export function installRepositoryTransport(transport: Transport): void {
  internalTransport = transport;
}
export async function transactionalEnabled(): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return false;
  }
  const state = await chrome.storage.local.get([
    "publicationBackend",
    "publicationMigrating",
  ]);
  if (
    state.publicationMigrating &&
    state.publicationBackend !== "transactional"
  ) {
    await repositoryRequest({ type: "publication.activate" });
    return true;
  }
  return state.publicationBackend === "transactional";
}
export async function repositoryRequest<T>(
  request: RepositoryRequest
): Promise<T> {
  if (internalTransport) {
    return (await internalTransport(request)) as T;
  }
  let error: unknown;
  // Retrying the identical request ID is safe; never synthesize another commit.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await chrome.runtime.sendMessage(request);
      if (!result) {
        throw new Error("Document coordinator did not respond.");
      }
      if (result.error) {
        throw new Error(result.error);
      }
      return result as T;
    } catch (failure) {
      error = failure;
    }
  }
  throw error;
}
export function readRepository(): Promise<RepositorySnapshot> {
  return repositoryRequest({ type: "publication.read" });
}
export async function writeLegacy(
  command: import("./legacy-mutation").LegacyMutation
): Promise<void> {
  await repositoryRequest({ type: "publication.legacyWrite", command });
}
export async function commitRepository(
  command: PreparedMutation
): Promise<CommitOutcome> {
  const outcome = await repositoryRequest<CommitOutcome>({
    type: "publication.commit",
    command,
  });
  if (outcome.status !== "committed") {
    throw new Error(
      outcome.status === "conflict"
        ? "Another window changed this record. Refresh or resolve the conflict before saving."
        : outcome.reason
    );
  }
  return outcome;
}
