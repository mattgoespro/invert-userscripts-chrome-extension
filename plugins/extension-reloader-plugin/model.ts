/**
 * Configuration for capturing and forwarding console output from extension pages
 * to the development server via WebSocket.
 */
export type CaptureConsoleOptions = {
  /**
   * The console log levels to intercept and forward (e.g., "log", "info", "warn", "error").
   */
  captureLevels: ("log" | "info" | "warn" | "error")[];
  /**
   * Optional predicate to filter out specific console messages.
   *
   * @param message - The arguments passed to the console method
   * @returns `true` to ignore the message, `false` to forward it
   */
  ignoreMessage?: (...message: unknown[]) => boolean;
};

/**
 * Options for the Chrome Extension Reloader Webpack plugin.
 * Controls the WebSocket-based hot-reload behavior during development.
 */
export interface ChromeExtensionReloaderPluginOptions {
  /**
   * The WebSocket server port. Defaults to `8081`.
   */
  port?: number;
  /**
   * Whether to enable verbose logging.
   */
  verbose?: boolean;
  /**
   * Whether to automatically launch the browser with the extension loaded on startup.
   */
  autoLaunchBrowser?: boolean;
  /**
   * Configuration for intercepting and forwarding console output from extension pages.
   */
  consoleOptions?: CaptureConsoleOptions;
  /**
   * List of asset names to exclude from extension reloader script injection.
   * Asset names should be specified relative to the Webpack output directory
   * (e.g. `"popup.html"`, `"assets/some-page.html"`).
   */
  excludeAssets?: string[];
}

/**
 * Message structure broadcast over the WebSocket connection between
 * the development server and connected extension clients.
 */
export type BroadcastMessage = {
  /**
   * The message type: `"configure"` for initial setup, `"reload"` to trigger a refresh, or `"log"` for forwarded console output.
   */
  type: "configure" | "reload" | "log";
  /**
   * Optional payload associated with the message.
   */
  data?: unknown;
};
