export type CaptureConsoleOptions = {
  captureLevels: ("log" | "info" | "warn" | "error")[];
  ignoreMessage?: (...message: unknown[]) => boolean;
};

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  verbose?: boolean;
  autoLaunchBrowser?: boolean;
  consoleOptions?: CaptureConsoleOptions;
  /**
   * List of asset names to exclude from extension reloader script injection.
   * Asset names should be specified relative to the Webpack output directory (e.g. "popup.html" or "assets/some-page.html").
   */
  excludeAssets?: string[];
}
export type BroadcastMessage = {
  type: "configure" | "reload" | "log";
  data?: unknown;
};
