import { execSync } from 'child_process';
import { apps, openApp } from 'open';
import path from 'path';
import webpack from 'webpack';
import WebSocket from 'ws';

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
  extensionDir: string;
  backgroundScriptEntryId: string;
  remoteDebugPort?: number;
  manifestPath?: string;
  launch?: boolean;
  timeoutMs?: number;
  reloadDebounceMs?: number;
  verbose?: boolean;
  debug?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';

  private _options: ChromeExtensionReloaderPluginOptions;
  private _colors = webpack.cli.createColors();

  private _sockets: { extension: WebSocket; activeTab: WebSocket } = {
    extension: null,
    activeTab: null,
  };
  private _extensionReloadTimer: NodeJS.Timeout = null;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
  }

  private normalizeOptions(options: ChromeExtensionReloaderPluginOptions) {
    return {
      backgroundScriptEntryId: options.backgroundScriptEntryId,
      extensionDir: options.extensionDir,
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      manifestPath: options.manifestPath ?? path.join(options.extensionDir, 'manifest.json'),
      launch: options.launch ?? false,
      reloadDebounceMs: options.reloadDebounceMs ?? 300,
      timeoutMs: options.timeoutMs ?? 30000,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Apply the extension reloader plugin to the Webpack compiler so that it integrates into the webpack build lifecycle.
   *
   * @param compiler The Webpack compiler instance.
   */
  async apply(compiler: webpack.Compiler) {
    compiler.hooks.initialize.tap(this.name, () => {
      this.logInfo(`Initialized.`);
    });

    compiler.hooks.afterCompile.tapAsync(
      this.name,
      (compilation: webpack.Compilation, done: () => void) => {
        const changedAssets = Object.keys(compilation.assets);

        if (changedAssets.length > 0) {
          this.logVerbose(`Rebuild detected, scheduling extension reload...`);
          this.scheduleReload();
        }

        done();
      }
    );

    compiler.hooks.shutdown.tap(this.name, () => {
      if (this._sockets.extension != null) {
        this._sockets.extension.close();
        this._sockets.extension = null;
        this.logVerbose(`Extension websocket connection closed.`);
      }

      if (this._sockets.activeTab != null) {
        this._sockets.activeTab.close();
        this._sockets.activeTab = null;
        this.logVerbose(`Active tab websocket connection closed.`);
      }
    });
  }

  /**
   * Main workflow to reload the extension and active tab.
   */
  private async reload(): Promise<void> {
    if (this._options.launch && !this.isBrowserOpen()) {
      this._log('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    const targets = await this.fetchBrowserDevToolsTargets();
    this.logDebug(`Successfully retrieved DevTools targets.`);

    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      this.logError(
        `Could not resolve the extension from the DevTools targets. Has the unpacked extension been loaded from the Extensions page?`
      );
      return;
    }

    if (
      this._sockets.extension == null ||
      this.getSocketConnectionStatus(this._sockets.extension) === 'unavailable'
    ) {
      this.logVerbose(`Connecting to extension...`);
      await this.connectWebSocket('extension', extensionTarget.webSocketDebuggerUrl);
    }

    await this.executeExtensionReload();

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      if (
        this._sockets.activeTab == null ||
        this.getSocketConnectionStatus(this._sockets.activeTab) === 'unavailable'
      ) {
        this.logVerbose(`Connecting to active tab...`);
        await this.connectWebSocket('activeTab', activeTabTarget.webSocketDebuggerUrl);
      }

      await this.executeBrowserActiveTabReload();
    }

    this.logInfo(`Reload succeeded.`);
  }

  private scheduleReload(): void {
    if (this._extensionReloadTimer != null) {
      clearTimeout(this._extensionReloadTimer);
    }

    this._extensionReloadTimer = setTimeout(() => {
      this.reload().catch((err) => this.logError(`Reload failed: ${err.message}`));
    }, this._options.reloadDebounceMs);
  }

  private async launchChromeWithRemoteDebugging() {
    return openApp(apps.browser, {
      arguments: [
        `--remote-debugging-port=${this._options.remoteDebugPort}`,
        `--user-data-dir="${path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'RemoteDebugProfile')}"`,
      ],
    });
  }

  private async connectWebSocket(socketName: keyof typeof this._sockets, debuggerUrl: string) {
    this._sockets[socketName] = new WebSocket(debuggerUrl);

    await Promise.race([
      new Promise<void>((resolve, reject) => {
        this._sockets[socketName].once('open', () => {
          this.logVerbose(`Websocket connected to ${socketName}.`);
          resolve();
        });
        this._sockets[socketName].once('error', reject);
      }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Connection to ${socketName} DevTools WebSocket timed out after ${this._options.timeoutMs}ms.`
              )
            ),
          this._options.timeoutMs
        )
      ),
    ]);
  }

  private async fetchBrowserDevToolsTargets() {
    return Promise.race([
      new Promise<DevToolsTarget[]>((resolve, reject) => {
        try {
          const output = execSync(
            `curl -s ${this.getDevtoolsTargetsUrl('/json/list')}`,
            { stdio: ['ignore', 'pipe', 'ignore'] } // ignore curl errors
          ).toString();

          resolve(JSON.parse(output));
        } catch (err) {
          reject(new Error(`Failed to fetch targets from browser: ${err.message}.`));
        }
      }),
      new Promise<DevToolsTarget[]>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Timed out fetching DevTools targets after ${this._options.timeoutMs}ms.`)
            ),
          this._options.timeoutMs
        )
      ),
    ]);
  }

  private resolveDevToolsExtensionTarget(targets: DevToolsTarget[]) {
    return targets.find(
      (t) => t.type === 'service_worker' && t.url.includes(this._options.backgroundScriptEntryId)
    );
  }

  private resolveDevToolsActiveTabTarget(targets: DevToolsTarget[]) {
    return (
      targets.find(
        (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
      ) ?? null
    );
  }

  private executeExtensionReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._sockets.extension, {
      method: 'Runtime.evaluate',
      params: { expression: 'chrome.runtime.reload()' },
    });
  }

  private executeBrowserActiveTabReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._sockets.activeTab, {
      method: 'Page.reload',
      params: { ignoreCache: true },
    });
  }

  private executeBrowserDevToolsCommand(
    socket: WebSocket,
    command: DevToolsCommand
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket == null || this.getSocketConnectionStatus(socket) === 'unavailable') {
        return reject(new Error('Failed to execute command: socket is unavailable.'));
      }

      socket.once('message', () => {
        resolve();
      });

      socket.on('error', reject);

      socket.send(JSON.stringify({ id: 1, ...command }));
    });
  }

  private isBrowserOpen(): boolean {
    try {
      const output = execSync(
        `curl -s ${this.getDevtoolsTargetsUrl('/json/version')}`,
        { stdio: ['ignore', 'pipe', 'ignore'] } // ignore curl errors
      ).toString();

      const json = JSON.parse(output);

      return typeof json?.Browser === 'string';
    } catch {
      return false;
    }
  }

  private getDevtoolsTargetsUrl(path: string): string {
    return `http://localhost:${this._options.remoteDebugPort}${path}`;
  }

  private getSocketConnectionStatus(socket: WebSocket): string {
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'unavailable';
      default:
        throw new Error(`${socket.url} - Unknown WebSocket state: ${socket.readyState}`);
    }
  }

  private _log(message: string, type: 'debug' | 'info' | 'warn' | 'error' | 'verbose' = 'info') {
    const createPrefix = () => {
      return `${this._colors.bold(this._colors.green('['))}${this._colors.bold(
        this._colors.green(this.name)
      )}${this._colors.bold(this._colors.green(']'))}`;
    };

    switch (type) {
      case 'debug': {
        if (!this._options.debug) {
          return;
        }

        console.log(createPrefix(), this._colors.dim(this._colors.gray(message)));
      }
      case 'verbose': {
        if (!this._options.verbose) {
          return;
        }

        console.log(createPrefix(), this._colors.gray(message));
      }
      case 'info':
        console.log(createPrefix(), this._colors.blue(message));
        break;
      case 'warn':
        console.warn(this._colors.bold(`${this._colors.yellow(createPrefix())} ${message}`));
        break;
      case 'error':
        console.error(this._colors.bold(`${this._colors.red(createPrefix())} ${message}`));
        break;
    }
  }

  private logInfo(message: string) {
    this._log(message, 'info');
  }

  private logWarn(message: string) {
    this._log(message, 'warn');
  }

  private logError(message: string) {
    this._log(message, 'error');
  }

  private logDebug(message: string) {
    this._log(message, 'debug');
  }

  private logVerbose(message: string) {
    this._log(message, 'verbose');
  }
}
