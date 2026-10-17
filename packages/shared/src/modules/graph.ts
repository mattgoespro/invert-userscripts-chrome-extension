import { getScriptModulePath, type Userscripts } from "../model";
import type { ModuleManifest } from "./manifest";

export interface GraphError {
  scriptId: string;
  kind: "cycle" | "missing" | "not-shared" | "unsupported";
  message: string;
}
export interface ResolvedModuleGraph {
  orderedIds: string[];
  errors: GraphError[];
}
export function affectedConsumers(
  changed: string[],
  scripts: Userscripts,
  manifests: Record<string, ModuleManifest>
): string[] {
  const ids = new Set(changed.filter((id) => Boolean(scripts[id])));
  let grew = true;
  while (grew) {
    grew = false;
    const paths = new Set(
      [...ids]
        .filter((id) => scripts[id]?.shared)
        .map((id) => getScriptModulePath(scripts[id]))
    );
    for (const [id, manifest] of Object.entries(manifests)) {
      if (
        !ids.has(id) &&
        scripts[id] &&
        manifest.imports.some(
          (edge) =>
            edge.runtime && edge.target === "main" && paths.has(edge.modulePath)
        )
      ) {
        ids.add(id);
        grew = true;
      }
    }
  }
  return [...ids];
}
export function resolveModuleGraph(
  roots: string[],
  scripts: Userscripts,
  manifests: Record<string, ModuleManifest>
): ResolvedModuleGraph {
  const byPath = new Map(
    Object.values(scripts).map((script) => [
      getScriptModulePath(script),
      script,
    ])
  );
  const visited = new Set<string>();
  const active = new Set<string>();
  const orderedIds: string[] = [];
  const errors: GraphError[] = [];
  const visit = (id: string): void => {
    if (active.has(id)) {
      errors.push({
        scriptId: id,
        kind: "cycle",
        message: "Cyclic shared dependency: " + id,
      });
      return;
    }
    if (visited.has(id)) {
      return;
    }
    const manifest = manifests[id];
    if (
      !scripts[id] ||
      !manifest ||
      manifest.source !== scripts[id].code.source.typescript
    ) {
      errors.push({
        scriptId: id,
        kind: "missing",
        message: "Current module analysis is unavailable: " + id,
      });
      return;
    }
    active.add(id);
    for (const diagnostic of manifest.diagnostics) {
      errors.push({
        scriptId: id,
        kind: "unsupported",
        message: diagnostic.message,
      });
    }
    for (const edge of manifest.imports) {
      if (!edge.runtime || !edge.modulePath) {
        continue;
      }
      if (edge.target === "types") {
        errors.push({
          scriptId: id,
          kind: "unsupported",
          message:
            "Declaration modules have no runtime values: " + edge.specifier,
        });
        continue;
      }
      const dependency = byPath.get(edge.modulePath);
      if (!dependency?.shared) {
        errors.push({
          scriptId: id,
          kind: dependency ? "not-shared" : "missing",
          message: "Runtime shared module unavailable: " + edge.specifier,
        });
      } else {
        visit(dependency.id);
      }
    }
    active.delete(id);
    visited.add(id);
    orderedIds.push(id);
  };
  roots.forEach(visit);
  return { orderedIds, errors };
}
