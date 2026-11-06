import { sanitizeModuleName, Userscript } from "@shared/model";

/**
 * The metadata changes for a rename. A module name that still mirrors the script
 * name follows the rename; an empty module name mirrors nothing, because a script
 * that was never shared must not start sharing as soon as its name is retyped.
 */
export function buildNameUpdates(
  script: Pick<Userscript, "name" | "moduleName">,
  name: string
): Partial<Userscript> {
  const updates: Partial<Userscript> = { name };
  if (
    script.moduleName &&
    script.moduleName === sanitizeModuleName(script.name)
  ) {
    const sanitized = sanitizeModuleName(name);
    updates.moduleName = sanitized;
    updates.shared = sanitized.length > 0;
  }
  return updates;
}
