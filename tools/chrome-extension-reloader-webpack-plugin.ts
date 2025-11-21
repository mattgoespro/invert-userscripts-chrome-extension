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
      console.log(`ChromeExtensionReloaderWebpackPlugin initialized.`);
    });

    compiler.hooks.afterCompile.tapAsync(
      this.name,
      (compilation: webpack.Compilation, done: () => void) => {
        const changedAssets = Object.keys(compilation.assets);

        if (changedAssets.length > 0) {
          console.log(`Rebuild detected. Scheduling extension reload...`);
          this.scheduleReload();
        }

        done();
      }
    );
  }

  /**
   * Main workflow to reload the extension and active tab.
   */
  private async reload(): Promise<void> {
    if (this._options.launch && !this.isBrowserOpen()) {
      console.log('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    const now = Date.now();
    const targets = await this.fetchBrowserDevToolsTargets();
    const elapsed = Date.now() - now;
    console.log(`Fetched DevTools targets in ${elapsed}ms.`);
    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      this.log(
        `Could not resolve the extension from the DevTools targets. Has the unpacked extension been loaded from the Extensions page?`,
        'warn'
      );
      return;
    }

    if (
      this._sockets.extension == null ||
      this.getSocketConnectionStatus(this._sockets.extension) === 'unavailable'
    ) {
      this.log(
        `Connecting to extension DevTools WebSocket at ${extensionTarget.webSocketDebuggerUrl}...`
      );
      await this.connectWebSocket('extension', extensionTarget.webSocketDebuggerUrl);
    }

    await this.executeExtensionReload();

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      if (
        this._sockets.activeTab == null ||
        this.getSocketConnectionStatus(this._sockets.activeTab) === 'unavailable'
      ) {
        this.log(
          `Connecting to active tab DevTools WebSocket at ${activeTabTarget.webSocketDebuggerUrl}...`
        );
        await this.connectWebSocket('activeTab', activeTabTarget.webSocketDebuggerUrl);
      }

      await this.executeBrowserActiveTabReload();
    }

    console.log(`Reload complete: "${extensionTarget.title}" (${extensionTarget.url})`);
  }

  private scheduleReload(): void {
    if (this._extensionReloadTimer != null) {
      clearTimeout(this._extensionReloadTimer);
    }

    this._extensionReloadTimer = setTimeout(() => {
      this.reload().catch((err) => console.error(`Reload failed:`, err));
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
        this._sockets.extension.once('open', () => {
          console.log(`Connected to extension DevTools WebSocket.`);
          resolve();
        });
        this._sockets.extension.once('error', reject);
      }),
      new Promise<void>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Timed out connecting to extension DevTools WebSocket after ${this._options.timeoutMs}ms.`
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

          const json = JSON.parse(output);
          resolve(json);
        } catch (err) {
          reject(
            new Error(
              `Failed to fetch DevTools targets from browser: ${err.message}. Is the browser running with remote debugging enabled?`
            )
          );
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
        return reject(new Error('Cannot send command: socket is unavailable.'));
      }

      socket.send(JSON.stringify({ id: 1, ...command }));

      socket.once('message', () => {
        resolve();
      });

      socket.on('error', reject);
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

  private log(message: string, type: 'info' | 'warn' | 'error' = 'info') {
    const prefixMessage = (message: string) => `[${this.name}] ${message}`;

    switch (type) {
      case 'info':
        console.log(this._colors.blue(prefixMessage(message)));
        break;
      case 'warn':
        console.warn(this._colors.bold(this._colors.yellow(prefixMessage(message))));
        break;
      case 'error':
        console.error(this._colors.bold(this._colors.red(prefixMessage(message))));
        break;
    }
  }
}
