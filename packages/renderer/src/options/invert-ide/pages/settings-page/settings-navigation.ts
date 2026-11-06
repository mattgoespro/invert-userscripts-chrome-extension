export type SettingsSectionId = "appearance" | "editor" | "build" | "advanced";

let pendingSection: SettingsSectionId | null = null;
const listeners = new Set<() => void>();

/**
 * Ask the Settings page to show a section. The page may not be mounted yet, so
 * the request waits until the page takes it.
 */
export function requestSettingsSection(section: SettingsSectionId): void {
  pendingSection = section;
  listeners.forEach((listener) => listener());
}

export function consumeSettingsSectionRequest(): SettingsSectionId | null {
  const section = pendingSection;
  pendingSection = null;
  return section;
}

export function subscribeToSettingsSectionRequests(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
