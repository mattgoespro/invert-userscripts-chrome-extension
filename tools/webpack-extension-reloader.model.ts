export interface DevToolsTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface DevToolsCommand {
  method: string;
  params?: Record<string, any>;
}

export interface ChromeExtensionReloaderPluginOptions {
  remoteDebugPort?: number;
  extensionDir: string;
  manifestPath?: string;
  launch?: boolean;
  reloadDebounceMs?: number;
}
