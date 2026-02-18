import { type CaptureConsoleOptions } from "./chrome-extension-reloader-webpack-plugin";

const serverWebsocketPort = `{{port}}`;
const serverWebsocketUrl = `ws://localhost:${serverWebsocketPort}`;
const storageKey = `__${chrome.runtime.id}__chrome_ext_snapshot__`;

console.log(`Storage key: ${storageKey}`);

const consoleFns = {
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
} as const;

type ConsoleLevel = keyof typeof consoleFns;

let websocket: WebSocket;

(() => {
  function patchConsole(options: CaptureConsoleOptions) {
    if (websocket == null || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const filterDefaultFn = () => true;
    const captureOptions = {
      level: typeof options.level === "boolean" && options.level ? "log" : options.level,
      filter: options.filter ?? filterDefaultFn,
    };
    const captureLevels: ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

    const shouldPatchLevel = (level: ConsoleLevel) =>
      captureLevels.indexOf(level) >= captureLevels.indexOf(captureOptions.level);
    const shouldCaptureMessage = (...message: unknown[]) =>
      captureOptions.filter(message) && websocket.readyState === WebSocket.OPEN;

    Object.assign(console, {
      debug: shouldPatchLevel("debug")
        ? (...args: Parameters<typeof console.debug>) => {
            consoleFns.debug(...args);
            if (shouldCaptureMessage(...args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns.debug,
      log: shouldPatchLevel("log")
        ? (...args: Parameters<typeof console.log>) => {
            consoleFns.log(...args);

            if (shouldCaptureMessage(...args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns.log,
      info: shouldPatchLevel("info")
        ? (...args: Parameters<typeof console.info>) => {
            consoleFns.info(...args);

            if (shouldCaptureMessage(...args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns.info,
      warn: shouldPatchLevel("warn")
        ? (...args: Parameters<typeof console.warn>) => {
            consoleFns.warn(...args);

            if (shouldCaptureMessage(...args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns.warn,
      error: shouldPatchLevel("error")
        ? (...args: Parameters<typeof console.error>) => {
            consoleFns.error(...args);

            if (shouldCaptureMessage(...args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns.error,
    });
  }

  function getState() {
    return {
      url: location.href,
      scroll: { x: window.scrollX, y: window.scrollY },
      inputs: Array.from(document.querySelectorAll("input, textarea, select")).map((el) => ({
        id: el.id ?? null,
        name:
          el instanceof HTMLInputElement || el instanceof HTMLSelectElement
            ? (el.name ?? null)
            : null,
        value: "value" in el ? el.value : null,
        checked: "checked" in el ? el.checked : null,
      })),
    };
  }

  function restoreState() {
    const snapshotData = sessionStorage.getItem(storageKey);

    if (!snapshotData) {
      return;
    }

    sessionStorage.removeItem(storageKey);

    const state = JSON.parse(snapshotData);

    requestAnimationFrame(() => {
      window.scrollTo(state.scroll.x, state.scroll.y);

      for (const input of state.inputs) {
        const element =
          (input.id && document.getElementById(input.id)) ||
          (input.name && document.querySelector(`[name="${input.name}"]`));

        if (!element) {
          continue;
        }

        if ("checked" in element && input.checked !== null) {
          element.checked = input.checked;
        }

        if ("value" in element && input.value !== null) {
          element.value = input.value;
        }
      }
    });
  }

  function reloadCSS() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

    for (const link of links) {
      const href = link.getAttribute("href");

      if (!href) {
        continue;
      }

      const domain = href.split("?")[0];
      link.setAttribute("href", `${domain}?t=${Date.now()}`);
    }
  }

  function saveStateAndReload() {
    sessionStorage.setItem(storageKey, JSON.stringify(getState()));
    location.reload();
  }

  function connect() {
    try {
      websocket = new WebSocket(serverWebsocketUrl);
    } catch {
      console.warn("Unable to connect, retrying in 1s...");
      setTimeout(connect, 1000);
      return;
    }

    websocket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "configure": {
          if (msg.captureConsole != null) {
            patchConsole(msg);
          }
          break;
        }
        case "reload": {
          reloadCSS();
          saveStateAndReload();
          break;
        }
        case "log": {
          console.log(msg.data);
          break;
        }
      }
    };

    websocket.onclose = () => setTimeout(connect, 1000);
  }

  if (document.readyState === "complete") {
    document.addEventListener("DOMContentLoaded", restoreState);
  } else {
    restoreState();
  }

  connect();
})();
