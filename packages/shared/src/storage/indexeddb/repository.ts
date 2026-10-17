import type {
  CommitOutcome,
  PreparedMutation,
  RepositorySnapshot,
  SavedDocument,
} from "../../publication/contracts";
import {
  applyMutation,
  createRepositoryState,
  type DocumentRepository,
  type StoredRepositoryState,
} from "../document-repository";
import { openDocumentDatabase } from "./database";
/** A single aggregate keeps sources, artifacts, receipts and outbox atomic. No awaits inside transactions. */
export class IndexedDocumentRepository implements DocumentRepository {
  private database?: Promise<IDBDatabase>;
  private async db(): Promise<IDBDatabase> {
    this.database ??= openDocumentDatabase().catch((error) => {
      this.database = undefined;
      throw error;
    });
    return this.database;
  }
  async state(): Promise<StoredRepositoryState> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("repository", "readonly");
      const request = tx.objectStore("repository").get("state");
      request.onsuccess = () =>
        resolve(request.result ?? createRepositoryState());
      request.onerror = () => reject(request.error);
    });
  }
  async update<T>(
    transform: (state: StoredRepositoryState) => {
      state: StoredRepositoryState;
      value: T;
    }
  ): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("repository", "readwrite");
      const store = tx.objectStore("repository");
      let value: T;
      let failure: unknown;
      const read = store.get("state");
      read.onsuccess = () => {
        try {
          const next = transform(read.result ?? createRepositoryState());
          value = next.value;
          store.put(next.state, "state");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error("Document transaction aborted.")
        );
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }
  async snapshot(): Promise<RepositorySnapshot> {
    const state = await this.state();
    return {
      documents: Object.values(state.documents),
      artifacts: state.artifacts,
      generation: state.generation,
      modules: state.modules,
      moduleRevision: state.moduleRevision,
      settings: state.settings,
      settingsRevision: state.settingsRevision,
    };
  }
  async read(id: string): Promise<SavedDocument | null> {
    return (await this.state()).documents[id] ?? null;
  }
  async readArtifacts(): Promise<RepositorySnapshot["artifacts"]> {
    return (await this.state()).artifacts;
  }
  async readReceipt(id: string): Promise<CommitOutcome | null> {
    return (await this.state()).receipts[id] ?? null;
  }
  commit(command: PreparedMutation): Promise<CommitOutcome> {
    return this.update((state) => {
      const next = applyMutation(state, command);
      return { state: next.state, value: next.outcome };
    });
  }
}
