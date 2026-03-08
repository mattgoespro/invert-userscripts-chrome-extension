import { ChildProcess, spawn } from "child_process";
import fs from "fs-extra";
import path from "path";

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

export function launchBrowser(options: {
  extensionPath: string;
  page?: string;
}): ChildProcess {
  const chromePath = resolveChromeExecutablePath();

  if (!chromePath) {
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
