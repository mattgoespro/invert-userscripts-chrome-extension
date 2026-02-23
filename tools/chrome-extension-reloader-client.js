const serverWebsocketPort = `{{port}}`;
const serverWebsocketUrl = `ws://localhost:${serverWebsocketPort}`;
const storageKey = `__${chrome.runtime.id}__chrome_ext_snapshot__`;

const consoleFns = {
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

let websocket;

(() => {
  function patchConsole(options) {
    if (websocket == null || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const captureOptions = {
      levels: options?.levels ?? ["log", "info", "warn", "error"],
      ignore: options?.ignore ?? (() => false),
    };
    const captureLevels = ["debug", "log", "info", "warn", "error"];

    const shouldPatchLevel = (level) =>
      captureLevels.indexOf(level) >= captureLevels.indexOf(captureOptions.levels);
    const shouldCaptureMessage = (message) =>
      websocket.readyState === WebSocket.OPEN && !captureOptions.ignore(message);

    const patchIfCapture = (level) =>
      shouldPatchLevel(level)
        ? (...args) => {
            consoleFns[level](...args);

            if (shouldCaptureMessage(args)) {
              websocket.send(JSON.stringify({ type: "log", data: args }));
            }
          }
        : consoleFns[level];

    Object.assign(console, {
      debug: patchIfCapture("debug"),
      log: patchIfCapture("log"),
      info: patchIfCapture("info"),
      warn: patchIfCapture("warn"),
      error: patchIfCapture("error"),
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
