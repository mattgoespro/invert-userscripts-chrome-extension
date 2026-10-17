import type {
  Userscript,
  GlobalModule,
  EditorSettings,
  CompiledCodeEntry,
} from "../model";
import { LegacyChromeSyncStorage } from "../storage/sync.storage";
import { LegacyCompiledCodeStorage } from "../storage/compiled.storage";
import { isStoredScript, isGlobalModules, isEditorSettings } from "./protocol";
export type LegacyMutation =
  | { kind: "saveScript"; script: Userscript }
  | {
      kind: "updateScript";
      id: string;
      updates: Partial<Omit<Userscript, "id">>;
    }
  | { kind: "deleteScript" | "deleteModule" | "deleteArtifact"; id: string }
  | { kind: "saveModule"; module: GlobalModule }
  | { kind: "saveSettings"; settings: Partial<EditorSettings> }
  | { kind: "saveArtifact"; id: string; artifact: CompiledCodeEntry }
  | { kind: "cleanupArtifacts"; ids: string[] };
/** Called only under the background's shared writer/cutover queue. */
export async function applyLegacyMutation(
  command: LegacyMutation
): Promise<void> {
  if (!command || typeof command !== "object") {
    throw new Error("Invalid legacy command.");
  }
  const validId = (id: unknown) =>
    typeof id === "string" &&
    id.length > 0 &&
    !["__proto__", "constructor", "prototype"].includes(id);
  switch (command.kind) {
    case "saveScript":
      if (
        !validId(command.script?.id) ||
        !isStoredScript(command.script, command.script.id)
      ) {
        break;
      }
      return LegacyChromeSyncStorage.saveScript(command.script);
    case "updateScript": {
      if (
        !validId(command.id) ||
        !command.updates ||
        typeof command.updates !== "object"
      ) {
        break;
      }
      const script = (await LegacyChromeSyncStorage.getAllScripts())[
        command.id
      ];
      if (
        !script ||
        !isStoredScript({ ...script, ...command.updates }, command.id)
      ) {
        break;
      }
      return LegacyChromeSyncStorage.updateScript(command.id, command.updates);
    }
    case "deleteScript":
      if (validId(command.id)) {
        return LegacyChromeSyncStorage.deleteScript(command.id);
      }
      break;
    case "saveModule":
      if (
        command.module &&
        isGlobalModules({ [command.module.id]: command.module })
      ) {
        return LegacyChromeSyncStorage.saveModule(command.module);
      }
      break;
    case "deleteModule":
      if (validId(command.id)) {
        return LegacyChromeSyncStorage.deleteModule(command.id);
      }
      break;
    case "saveSettings":
      if (isEditorSettings(command.settings)) {
        return LegacyChromeSyncStorage.saveEditorSettings(command.settings);
      }
      break;
    case "saveArtifact":
      if (
        validId(command.id) &&
        typeof command.artifact?.javascript === "string" &&
        typeof command.artifact.css === "string"
      ) {
        return LegacyCompiledCodeStorage.saveCompiledCode(
          command.id,
          command.artifact
        );
      }
      break;
    case "deleteArtifact":
      if (validId(command.id)) {
        return LegacyCompiledCodeStorage.deleteCompiledCode(command.id);
      }
      break;
    case "cleanupArtifacts":
      if (Array.isArray(command.ids) && command.ids.every(validId)) {
        return LegacyCompiledCodeStorage.cleanupOrphaned(new Set(command.ids));
      }
      break;
  }
  throw new Error("Invalid legacy command.");
}
