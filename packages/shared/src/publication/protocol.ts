import type { PreparedMutation } from "./contracts";
import type { EditorSettings, GlobalModules } from "../model";
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
export function isStoredScript(value: unknown, id: string): boolean {
  if (
    !record(value) ||
    value.id !== id ||
    typeof value.name !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.shared !== "boolean" ||
    typeof value.moduleName !== "string" ||
    typeof value.typeDefinitions !== "string" ||
    !Array.isArray(value.urlPatterns) ||
    !value.urlPatterns.every((item) => typeof item === "string") ||
    !Array.isArray(value.globalModules) ||
    !value.globalModules.every((item) => typeof item === "string") ||
    !Array.isArray(value.sharedScripts) ||
    !value.sharedScripts.every((item) => typeof item === "string") ||
    !["beforePageLoad", "afterPageLoad"].includes(String(value.runAt)) ||
    !record(value.code) ||
    !record(value.code.source)
  ) {
    return false;
  }
  return (
    typeof value.code.source.typescript === "string" &&
    typeof value.code.source.scss === "string"
  );
}
export function isGlobalModules(value: unknown): value is GlobalModules {
  return (
    record(value) &&
    Object.entries(value).every(
      ([id, module]) =>
        record(module) &&
        module.id === id &&
        !["__proto__", "constructor", "prototype"].includes(id) &&
        typeof module.name === "string" &&
        typeof module.url === "string" &&
        /^https?:\/\//.test(module.url) &&
        typeof module.enabled === "boolean" &&
        (module.packageName === undefined ||
          typeof module.packageName === "string") &&
        (module.typeVersion === undefined ||
          typeof module.typeVersion === "string")
    )
  );
}
export function isEditorSettings(value: unknown): value is EditorSettings {
  if (!record(value)) {
    return false;
  }
  if (
    value.fontSize !== undefined &&
    (typeof value.fontSize !== "number" ||
      value.fontSize < 8 ||
      value.fontSize > 32)
  ) {
    return false;
  }
  if (
    value.tabSize !== undefined &&
    (typeof value.tabSize !== "number" ||
      value.tabSize < 2 ||
      value.tabSize > 8)
  ) {
    return false;
  }
  return (
    ["theme", "appTheme"].every(
      (key) => value[key] === undefined || typeof value[key] === "string"
    ) &&
    ["autoFormat", "errorLens", "minifyCompiledOutput"].every(
      (key) => value[key] === undefined || typeof value[key] === "boolean"
    )
  );
}
export function isPublicationCommand(
  value: unknown
): value is PreparedMutation {
  if (
    !record(value) ||
    typeof value.requestId !== "string" ||
    !value.requestId ||
    !Array.isArray(value.writes) ||
    value.writes.length > 1000
  ) {
    return false;
  }
  const ids = new Set<string>();
  for (const write of value.writes) {
    if (
      !record(write) ||
      typeof write.id !== "string" ||
      ids.has(write.id) ||
      ["__proto__", "constructor", "prototype"].includes(write.id) ||
      write.migrationRevision !== undefined ||
      !(
        write.expectedRevision === null ||
        typeof write.expectedRevision === "string"
      )
    ) {
      return false;
    }
    ids.add(write.id);
    if (write.deleted === true) {
      if (write.script || write.artifact) {
        return false;
      }
    } else if (write.script && !isStoredScript(write.script, write.id)) {
      return false;
    } else if (!write.script && !write.artifact) {
      return false;
    }
    if (
      write.artifact &&
      (!record(write.artifact) ||
        typeof write.artifact.javascript !== "string" ||
        typeof write.artifact.css !== "string")
    ) {
      return false;
    }
  }
  for (const field of ["modules", "settings"]) {
    const item = value[field];
    if (
      item !== undefined &&
      (!record(item) ||
        !record(item.value) ||
        !(
          item.expectedRevision === null ||
          typeof item.expectedRevision === "string"
        ))
    ) {
      return false;
    }
  }
  if (
    value.modules &&
    !isGlobalModules((value.modules as Record<string, unknown>).value)
  ) {
    return false;
  }
  if (
    value.settings &&
    !isEditorSettings((value.settings as Record<string, unknown>).value)
  ) {
    return false;
  }
  return true;
}
export function isTrustedExtensionSender(
  sender: { id?: string; url?: string },
  extensionId: string
): boolean {
  if (sender.id !== extensionId || !sender.url) {
    return false;
  }
  try {
    const url = new URL(sender.url);
    return (
      url.protocol === "chrome-extension:" &&
      url.hostname === extensionId &&
      ["/options.html", "/popup.html"].includes(url.pathname)
    );
  } catch {
    return false;
  }
}
