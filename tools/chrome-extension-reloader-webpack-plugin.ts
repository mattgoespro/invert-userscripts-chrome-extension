import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import WebSocket from 'ws';
import type { Logger } from './utils.ts';
import { createLogger, resolveChromeExecutablePath } from './utils.ts';

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
  launchBrowser?: boolean;
  openBrowserPage?: string;
  timeoutMs?: number;
  verbose?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';
  private readonly cacheDir = path.join(
    process.cwd(),
    'node_modules',
    '.cache',
    'chrome-extension-reloader-webpack-plugin'
  );

  private _log: Logger;
  private _options: ChromeExtensionReloaderPluginOptions;
  private _extensionPath: string;
  private _extensionId: string;
  private _manifestKey: string;
  private _extensionConnection: WebSocket = null;
  private _activeTabConnection: WebSocket = null;
  private _activeReload: NodeJS.Timeout = null;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.setExtensionId();
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      launchBrowser: options.launchBrowser ?? false,
      openBrowserPage: options.openBrowserPage ?? 'options.html',
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
    this._extensionPath = compiler.options.output.path;

    compiler.hooks.emit.tap(this.name, (compilation) => {
      const manifestName = 'manifest.json';
      const asset = compilation.assets[manifestName];

      if (asset) {
        const source = asset.source().toString();
        const manifest = JSON.parse(source);
        manifest.key = this._manifestKey;
        const newSource = JSON.stringify(manifest, null, 2);

        compilation.updateAsset(manifestName, new webpack.sources.RawSource(newSource));
      }
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        this._log.info(`Build completed. Scheduling extension reload...`);
        this.scheduleReload();
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this.disconnect();
    });
  }

  private scheduleReload(): void {
    if (this._activeReload != null) {
      this._log.verbose(`Clearing pending reload...`);
      clearTimeout(this._activeReload);
    }

    this._activeReload = setTimeout(async () => {
      try {
        await this.reload();
        this._log.info(`Reload finished.`);
      } catch (error) {
        console.error(error);
        this._log.warn(`Reload failed: ${error.message}`);
      } finally {
        this._activeReload = null;
      }
    }, 1000);
  }

  /**
   * Main extension workflow.
   */
  private async reload(): Promise<void> {
    if (this._options.launchBrowser && !(await this.isBrowserOpen())) {
      this._log.info('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    const targets = await this.fetchBrowserDevToolsTargets();

    if (targets == null) {
      throw new Error(`Failed to fetch Chrome targets.`);
    }

    this._log.verbose(`Retrieved ${targets.length} devtools targets:`);

    for (const target of targets) {
      this._log.verbose(`- ${target.type}: ${target.title} (${target.url})`);
    }

    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      throw new Error(`The Chrome browser target for the extension runtime wasn't found.`);
    }

    this._log.verbose(`Resolved extension runtime target:`);
    this._log.verbose(extensionTarget);

    if (
      this._extensionConnection == null ||
      this.getSocketConnectionStatus(this._extensionConnection) === 'unavailable'
    ) {
      this._log.verbose(`Connecting to extension runtime...`);
      this._extensionConnection = new WebSocket(extensionTarget.webSocketDebuggerUrl);

      await new Promise<void>((resolve, reject) => {
        this._extensionConnection
          .on('open', () => {
            this._log.verbose(`Connected to extension runtime.`);
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    }

    this._log.verbose(`Executing extension runtime reload...`);

    await this.executeExtensionReload();

    this._log.verbose(`Extension runtime reloaded.`);

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      this._log.verbose(`Resolved active tab target:`);
      this._log.verbose(activeTabTarget);

      if (
        this._activeTabConnection == null ||
        this.getSocketConnectionStatus(this._activeTabConnection) === 'unavailable'
      ) {
        this._activeTabConnection = new WebSocket(activeTabTarget.webSocketDebuggerUrl);
        await this.connectWebSocket(this._activeTabConnection);
      }

      this._log.verbose(`Executing active tab reload...`);
      await this.executeBrowserActiveTabReload();
      this._log.verbose(`Active tab reloaded.`);
    }
  }

  private async connectWebSocket(connection: WebSocket) {
    await new Promise<void>((resolve, reject) => {
      connection
        .on('open', () => {
          this._log.verbose(`Connected to active tab.`);
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  private disconnect() {
    if (this._extensionConnection != null) {
      this._extensionConnection.close(0);
      this._extensionConnection = null;
      this._log.verbose(`Extension runtime websocket connection closed.`);
    }

    if (this._activeTabConnection != null) {
      this._activeTabConnection.close(0);
      this._activeTabConnection = null;
      this._log.verbose(`Active tab websocket connection closed.`);
    }
  }

  private setExtensionId() {
    fs.ensureDirSync(this.cacheDir);

    const keyPath = path.join(this.cacheDir, 'key.pem');

    if (fs.existsSync(keyPath)) {
      const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
      const keyObject = crypto.createPrivateKey(privateKeyPem);
      const publicKeyObject = crypto.createPublicKey(keyObject);
      const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });

      this._manifestKey = publicKeyDer.toString('base64');
      this._extensionId = this.calculateExtensionId(publicKeyDer);

      this._log.verbose(`Extension ID: ${this._extensionId}`);
      this._log.verbose(`Manifest key: ${this._manifestKey.slice(0, 32)}...`);
      return;
    }

    this._log.verbose(`Generating a new manifest key...`);

    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(keyPath, keyPair.privateKey);

    this._manifestKey = keyPair.publicKey.toString('base64');
    this._extensionId = this.calculateExtensionId(keyPair.publicKey);

    this._log.verbose(`Extension ID: ${this._extensionId}`);
    this._log.verbose(`Manifest key: ${this._manifestKey.slice(0, 32)}...`);
  }

  private calculateExtensionId(publicKey: Buffer): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    const first128Bits = hash.slice(0, 32);

    return first128Bits
      .split('')
      .map((char) => {
        const code = parseInt(char, 16);
        return String.fromCharCode(97 + code);
      })
      .join('');
  }

  private async fetchBrowserDevToolsTargets(): Promise<DevToolsTarget[]> {
    let attempts = 1;
    const maxAttempts = 10;

    while (attempts++ <= maxAttempts) {
      try {
        this._log.verbose(
          `Fetching Chrome devtools targets (attempt ${attempts}/${maxAttempts})...`
        );

        const response = await fetch(this.getDevtoolsTargetsUrl('/json'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          return (await response.json()) as DevToolsTarget[];
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return null;
  }

  private async launchChromeWithRemoteDebugging() {
    const userDataDir = path.join(this.cacheDir, 'remote-debugging-profile');
    const chromePath = resolveChromeExecutablePath();

    if (chromePath == null) {
      throw new Error('Could not find Chrome executable.');
    }

    const child = spawn(
      chromePath,
      [
        `--remote-debugging-port=${this._options.remoteDebugPort}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        `--load-extension=${this._extensionPath}`,
        `chrome-extension://${this._extensionId}/${this._options.openBrowserPage}`,
      ],
      {
        detached: true,
        stdio: 'ignore',
      }
    ).on('error', (err) => {
      this._log.error(`Failed to start Chrome: ${err.message}`);
    });

    child.unref();
  }

  private resolveDevToolsExtensionTarget(targets: DevToolsTarget[]) {
    return targets.find((t) => t.url.startsWith(`chrome-extension://${this._extensionId}`));
  }

  private resolveDevToolsActiveTabTarget(targets: DevToolsTarget[]) {
    return (
      targets.find(
        (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
      ) ?? null
    );
  }

  private executeExtensionReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._extensionConnection, {
      method: 'Runtime.evaluate',
      params: { expression: 'chrome.runtime.reload()' },
    });
  }

  private executeBrowserActiveTabReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._activeTabConnection, {
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
        this._log.warn(`WebSocket connection is unavailable.`);
        return reject(new Error('Unable to execute command: socket is unavailable.'));
      }

      socket
        .once('message', () => {
          this._log.verbose(`Command executed: ${command.method}`);
          resolve();
        })
        .on('error', (err) => {
          this._log.error(`Unable to execute command ${command.method}: ${err.message}`);
          reject(err);
        });

      socket.send(JSON.stringify({ id: 1, ...command }));
    });
  }

  private async isBrowserOpen(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      fetch(this.getDevtoolsTargetsUrl('/json'))
        .then((response) => {
          if (!response.ok) {
            return resolve(false);
          }

          resolve(response.ok);
        })
        .catch(() => {
          resolve(false);
        });
    });
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
}
