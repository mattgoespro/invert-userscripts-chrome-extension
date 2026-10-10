export interface IdeWorkspaceEffects {
  initialize(): Promise<void>;
  attachWorkspace(): () => void;
  rebuildStaleArtifacts(): Promise<void>;
  markReady(): void;
  reportError(error: unknown): void;
}

/** Owns startup continuations and the synchronization acquired by this mount. */
export function startIdeWorkspace(effects: IdeWorkspaceEffects): () => void {
  let active = true;
  let stopWorkspace: (() => void) | undefined;

  void (async () => {
    try {
      await effects.initialize();
      if (!active) {
        return;
      }
      stopWorkspace = effects.attachWorkspace();
      await effects.rebuildStaleArtifacts();
      if (active) {
        effects.markReady();
      }
    } catch (error) {
      effects.reportError(error);
      if (active) {
        effects.markReady();
      }
    }
  })();

  return () => {
    if (!active) {
      return;
    }
    active = false;
    stopWorkspace?.();
  };
}
