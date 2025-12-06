import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import WebSocket from 'ws';
import type { Logger } from './utils.ts';
import { createLogger, getChromePath } from './utils.ts';

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
  timeoutMs?: number;
  verbose?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';
  private readonly dataDir = path.join(process.cwd(), '.cache', 'chrome-extension-reloader');

  private _options: ChromeExtensionReloaderPluginOptions;

  private _extensionId: string;
  private _manifestKey: string;

  private _extensionConnection: WebSocket = null;
  private _activeTabConnection: WebSocket = null;
  private _log: Logger;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.setExtensionId();
  }

  get manifestKey(): string {
    return this._manifestKey;
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      launchBrowser: options.launchBrowser ?? false,
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
    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        try {
          await this.reload();
          this._log.info(`Reload finished.`);
        } catch (error) {
          console.error(error);
          this._log.error(`Reload failed: ${error.message}`);
        }
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this.disconnect();
    });

    compiler.hooks.watchClose.tap(this.name, () => {
      this.disconnect();
    });
  }

  /**
   * Main extension workflow.
   */
  private async reload(): Promise<void> {
    const isBrowserOpen = await this.isBrowserOpen();
    this._log.verbose(`Browser is open: ${isBrowserOpen}`);

    if (this._options.launchBrowser && !isBrowserOpen) {
      this._log.info('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    const targets = await this.fetchBrowserDevToolsTargets();

    if (targets == null) {
      this._log.warn(`Could not connect to browser devtools within ${this._options.timeoutMs}ms.`);
      return;
    }

    this._log.verbose(`Retrieved ${targets.length} devtools targets.`);

    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      throw new Error(`The devtools target for the extension could not be found.`);
    }

    this._log.verbose(`Resolved extension target:`);
    this._log.verbose(extensionTarget);

    if (this._extensionConnection == null) {
      this._log.verbose(`Connecting to extension...`);
      this._extensionConnection = new WebSocket(extensionTarget.webSocketDebuggerUrl);

      await new Promise<void>((resolve, reject) => {
        this._extensionConnection.on('open', () => {
          this._log.verbose(`Connected to extension.`);
          resolve();
        });
        this._extensionConnection.on('error', (err) => {
          this._log.error(`Failed to connect to extension: ${err.message}`);
          reject(err);
        });
      });
    }

    this._log.info(`Executing extension reload...`);

    await this.executeExtensionReload();

    this._log.info(`Extension reloaded.`);

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      this._log.verbose(`Resolved active tab target:`);
      this._log.verbose(activeTabTarget);

      if (this._activeTabConnection == null) {
        this._activeTabConnection = new WebSocket(activeTabTarget.webSocketDebuggerUrl);
        await new Promise<void>((resolve, reject) => {
          this._activeTabConnection.on('open', () => {
            this._log.verbose(`Connected to active tab.`);
            resolve();
          });
          this._activeTabConnection.on('error', (err) => {
            this._log.error(`Failed to connect to active tab: ${err.message}`);
            reject(err);
          });
        });
      }

      this._log.info(`Executing active tab reload...`);
      await this.executeBrowserActiveTabReload();
    }
  }

  private disconnect() {
    if (this._extensionConnection != null) {
      this._extensionConnection.close(0);
      this._extensionConnection = null;
      this._log.verbose(`Extension websocket connection closed.`);
    }

    if (this._activeTabConnection != null) {
      this._activeTabConnection.close(0);
      this._activeTabConnection = null;
      this._log.verbose(`Active tab websocket connection closed.`);
    }
  }

  private setExtensionId() {
    fs.ensureDirSync(this.dataDir);

    const keyPath = path.join(this.dataDir, 'key.pem');

    if (fs.existsSync(keyPath)) {
      try {
        const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
        const keyObject = crypto.createPrivateKey(privateKeyPem);
        const publicKeyObject = crypto.createPublicKey(keyObject);
        const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });

        this._manifestKey = publicKeyDer.toString('base64');
        this._extensionId = this.calculateExtensionId(publicKeyDer);

        this._log.verbose(`Extension ID: ${this._extensionId}`);
        this._log.verbose(`Manifest key: ${this._manifestKey}`);
      } catch (error) {
        this._log.warn(
          `Failed to load existing manifest key: ${error.message}. Generating a new one...`
        );
        const keyPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'der' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        fs.writeFileSync(keyPath, keyPair.privateKey);

        this._manifestKey = keyPair.publicKey.toString('base64');
        this._extensionId = this.calculateExtensionId(keyPair.publicKey);

        this._log.info(`Generated new manifest key.`);
      }
    }
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

    while (attempts <= maxAttempts) {
      try {
        const response = await fetch(this.getDevtoolsTargetsUrl('/json'), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          return (await response.json()) as DevToolsTarget[];
        }
      } catch (error) {
        this._log.verbose(`Waiting for browser...`);
        attempts += 1;
      }
    }

    return null;
  }

  private async launchChromeWithRemoteDebugging() {
    const userDataDir = path.resolve(path.join(process.cwd(), '.cache', 'chrome-user-data-v2'));
    const extensionPath = path.resolve(path.join(process.cwd(), 'dist'));
    const chromePath = getChromePath();

    if (!chromePath) {
      throw new Error('Could not find Chrome executable.');
    }

    const args = [
      `--remote-debugging-port=${this._options.remoteDebugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--load-extension=${extensionPath}`,
      'about:blank',
    ];

    const child = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (err) => {
      this._log.error(`Failed to start Chrome: ${err.message}`);
    });

    child.unref();
  }

  private resolveDevToolsExtensionTarget(targets: DevToolsTarget[]) {
    return targets.find(
      (t) =>
        t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${this._extensionId}`)
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
        return reject(new Error('Failed to execute command: socket is unavailable.'));
      }

      socket
        .once('message', () => {
          this._log.verbose(`Command executed: ${command.method}`);
          resolve();
        })
        .on('error', (err) => {
          this._log.error(`Failed to execute command ${command.method}: ${err.message}`);
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
