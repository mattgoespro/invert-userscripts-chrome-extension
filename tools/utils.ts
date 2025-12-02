import { apps, openApp } from 'open';
import webpack from 'webpack';
import path from 'path';

export const createLogger = (name: string, options: { prefix: string; verbose?: boolean }) => {
  const colors = webpack.cli.createColors();

  const createPrefix = (level: string, color: (text: string) => string) =>
    colors.bold(color(level));

  return {
    info: (message: string) => {
      console.info(
        `${colors.blue(name)} ${createPrefix('INFO', colors.green)} ${colors.greenBright(message)}`
      );
    },
    warn: (message: string) => {
      console.warn(
        `${colors.blue(name)} ${createPrefix('WARN', colors.yellow)} ${colors.yellowBright(message)}`
      );
    },
    error: (message: string) => {
      console.error(
        `${colors.blue(name)} ${createPrefix('ERROR', colors.red)} ${colors.redBright(message)}`
      );
    },
    verbose: (message: string | object) => {
      if (!options.verbose) {
        return;
      }

      if (Object.getPrototypeOf(message) === Object.prototype) {
        console.info(colors.gray(colors.italic(JSON.stringify(message, null, 2))));
        return;
      }

      console.info(
        `${colors.blue(name)} ${createPrefix('VERBOSE', colors.gray)} ${colors.gray(colors.italic(message))}`
      );
    },
  };
};

export type Logger = ReturnType<typeof createLogger>;

export async function launchChromeWithRemoteDebugging(remoteDebugPort: number) {
  return openApp(apps.browser, {
    arguments: [
      `--remote-debugging-port=${remoteDebugPort}`,
      `--user-data-dir="${path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'RemoteDebuggingProfile')}"`,
    ],
  });
}
