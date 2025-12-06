import { apps, openApp } from 'open';
import webpack from 'webpack';
import path from 'path';
import fs from 'fs-extra';

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

      if (message != null && Object.getPrototypeOf(message) === Object.prototype) {
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

export function getChromePath(): string | undefined {
  const suffixes = [
    '\\Google\\Chrome\\Application\\chrome.exe',
    '\\Google\\Chrome SxS\\Application\\chrome.exe',
    '\\Chromium\\Application\\chrome.exe',
  ];
  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
  ].filter(Boolean) as string[];

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const chromePath = path.join(prefix, suffix);
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  return undefined;
}
