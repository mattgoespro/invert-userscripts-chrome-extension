import type {
  Userscripts,
  CompiledCodeEntry,
  GlobalModules,
  EditorSettings,
} from "../../model";
import { sha256 } from "../sync/revision-codec";
import type { IndexedDocumentRepository } from "./repository";
import { serializeUserscript } from "../userscript-payload";
import { applyMutation, emptyRepositoryState } from "../document-repository";
import { isCompiledArtifactFresh } from "../../compile-metadata";
export function legacyDocumentRevision(
  script: Userscripts[string]
): Promise<string> {
  return sha256(JSON.stringify([script.id, serializeUserscript(script)])).then(
    (digest) => "legacy-" + digest
  );
}
export interface LegacySnapshot {
  scripts: Userscripts;
  artifacts: Record<string, CompiledCodeEntry>;
  modules: GlobalModules;
  settings: EditorSettings;
}
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      : item
  );
}
function sourceIdentity(snapshot: LegacySnapshot): string {
  return canonical({
    scripts: Object.fromEntries(
      Object.values(snapshot.scripts).map((script) => [
        script.id,
        serializeUserscript(script),
      ])
    ),
    modules: snapshot.modules,
    settings: snapshot.settings,
  });
}
/** Only for an inactive shadow. Replace the mirror so retries cannot resurrect deleted legacy records. */
export async function migrateLegacyDocuments(
  repository: IndexedDocumentRepository,
  read: () => Promise<LegacySnapshot>
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await read();
    const digest = await sha256(canonical(before));
    const writes = await Promise.all(
      Object.values(before.scripts).map(async (script) => ({
        id: script.id,
        expectedRevision: null as string | null,
        script,
        artifact: isCompiledArtifactFresh(
          script,
          before.artifacts[script.id],
          before.settings.minifyCompiledOutput ?? false
        )
          ? before.artifacts[script.id]
          : undefined,
        migrationRevision: await legacyDocumentRevision(script),
      }))
    );
    await repository.update((previous) => {
      const mirror = emptyRepositoryState();
      mirror.generation = previous.generation;
      const result = applyMutation(mirror, {
        requestId: "migration:" + digest,
        writes,
        modules: { expectedRevision: null, value: before.modules },
        settings: { expectedRevision: null, value: before.settings },
      });
      if (result.outcome.status !== "committed") {
        throw new Error(
          "Legacy data cannot be migrated: " + result.outcome.status
        );
      }
      // The shadow already exists in legacy sync. Republishing it could overwrite a
      // legacy write that lands at cutover; only subsequent local edits enter the outbox.
      result.state.outbox = {};
      result.state.preferenceOutbox = {};
      result.state.legacyObserved = Object.fromEntries(
        Object.values(result.state.documents).map((document) => [
          document.script.id,
          document.revision,
        ])
      );
      return { state: result.state, value: undefined };
    });
    const after = await read();
    if ((await sha256(canonical(after))) !== digest) {
      continue;
    }
    const verified = await repository.snapshot();
    const actual = {
      scripts: Object.fromEntries(
        verified.documents.map((document) => [
          document.script.id,
          document.script,
        ])
      ),
      artifacts: verified.artifacts,
      modules: verified.modules,
      settings: verified.settings,
    };
    if (sourceIdentity(after) === sourceIdentity(actual)) {
      return;
    }
  }
  throw new Error(
    "Saved data changed during migration. Close other IDE windows and retry."
  );
}
