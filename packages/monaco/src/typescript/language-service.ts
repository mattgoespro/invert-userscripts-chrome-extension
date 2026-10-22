import { syncWorkspaceModels, type WorkspaceFile } from "./vfs";
import {
  syncModulePackageJsons,
  syncAmbientTypeDefinitionLibs,
  refreshTypescriptDiagnosticsIfProgramFilesChanged,
} from "./defaults";
import { syncCdnModuleLibs, type CdnModuleInfo } from "./cdn-types";
export interface LanguageWorkspaceProjection {
  files: WorkspaceFile[];
  modulePaths: string[];
  aliases?: { id: string; modulePath: string }[];
  cdnModules: CdnModuleInfo[];
  typeDefinitionLibs?: import("./defaults").AmbientTypeDefinitionLibInfo[];
}
let lastCdnSignature = "";
let acquisitionError = "";
const listeners = new Set<() => void>();
export function getLanguageAcquisitionError(): string {
  return acquisitionError;
}
export function subscribeLanguageAcquisition(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function setAcquisitionError(message: string): void {
  acquisitionError = message;
  for (const listener of listeners) {
    listener();
  }
}
let lastProjection: LanguageWorkspaceProjection | undefined;
export function retryLanguageAcquisition(): void {
  lastCdnSignature = "";
  if (lastProjection) {
    reconcileLanguageWorkspace(lastProjection);
  }
}
/** One boundary for all stock-worker program reconciliation. */
export function reconcileLanguageWorkspace(
  projection: LanguageWorkspaceProjection
): void {
  lastProjection = projection;
  syncModulePackageJsons(projection.modulePaths, projection.aliases);
  syncWorkspaceModels(projection.files);
  refreshTypescriptDiagnosticsIfProgramFilesChanged(
    projection.files
      .filter((file) => file.language === "typescript")
      .map((file) => file.uri)
  );
  syncAmbientTypeDefinitionLibs(projection.typeDefinitionLibs ?? []);
  const signature = JSON.stringify(projection.cdnModules);
  if (signature === lastCdnSignature) {
    return;
  }
  lastCdnSignature = signature;
  void syncCdnModuleLibs(projection.cdnModules)
    .then(() => {
      if (lastCdnSignature === signature) {
        setAcquisitionError("");
      }
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (lastCdnSignature !== signature) {
        return;
      }
      lastCdnSignature = "";
      setAcquisitionError(
        error instanceof Error ? error.message : String(error)
      );
      console.warn("CDN declaration acquisition failed:", error);
    });
}
