import webpack from "webpack";
import path from "path";
import fs from "fs-extra";
import { ChildProcess, spawn } from "child_process";
import console from "console";

type LogLevel = "INFO" | "WARN" | "ERROR" | "VERB";

export const createLogger = (name: string, options: { verbose?: boolean }) => {
  const Colors = webpack.cli.createColors();
  const loggerName = `${Colors.italic(Colors.cyan(name))} `;

  const padLevel = (level: LogLevel) => level.padEnd(5);

  const styleLevel = (level: LogLevel, color: (text: string) => string) =>
    Colors.bold(color(padLevel(level)));

  const createMessage = (level: LogLevel, message: string) =>
    `${loggerName} ${styleLevel(level, getColorFunction(level))} ${message}`;

  const getColorFunction = (level: LogLevel) => {
    switch (level) {
      case "INFO":
        return Colors.greenBright;
      case "WARN":
        return Colors.yellowBright;
      case "ERROR":
        return Colors.redBright;
      case "VERB":
        return Colors.gray;
      default:
        return Colors.white;
    }
  };

  return {
    info: (message: string) => {
      console.info(
        `${loggerName} ${styleLevel("INFO", Colors.green)} ${Colors.greenBright(message)}`
      );
    },
    warn: (message: string) => {
      console.warn(
        `${loggerName} ${styleLevel("WARN", Colors.yellow)} ${Colors.yellowBright(message)}`
      );
    },
    error: (message: string) => {
      console.error(
        `${loggerName} ${styleLevel("ERROR", Colors.red)} ${Colors.redBright(message)}`
      );
    },
    verbose: (message: string | object) => {
      if (!options.verbose) {
        return;
      }

      if (message != null && Object.getPrototypeOf(message) === Object.prototype) {
        console.info(Colors.gray(Colors.italic(JSON.stringify(message, null, 2))));
        return;
      }

      console.info(
        `${loggerName} ${styleLevel("VERB", Colors.gray)} ${Colors.gray(Colors.italic(message))}`
      );
    },
    createMessage,
  };
};

export type Logger = ReturnType<typeof createLogger>;

export function resolveChromeExecutablePath(): string | undefined {
  const suffixes = [
    "\\Google\\Chrome\\Application\\chrome.exe",
    "\\Google\\Chrome SxS\\Application\\chrome.exe",
    "\\Chromium\\Application\\chrome.exe",
  ];
  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
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

const ServiceWorkerClientScriptPath = path.join(
  import.meta.dirname,
  "chrome-extension-reloader-client.js"
);

export function loadReloaderClient(variables: string[][]): string {
  let script = fs.readFileSync(ServiceWorkerClientScriptPath, "utf-8");

  for (const [variable, value] of variables) {
    script = script.replace(`{{${variable}}}`, value);
  }

  return script;
}

export function launchBrowser(options: { extensionPath: string; page?: string }): ChildProcess {
  const chromePath = resolveChromeExecutablePath();

  if (chromePath == null) {
    throw new Error("Chrome not found");
  }

  return spawn(
    chromePath,
    [
      `--load-extension=${options.extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      options.page ?? "",
    ],
    { detached: true, stdio: "ignore" }
  );
}
