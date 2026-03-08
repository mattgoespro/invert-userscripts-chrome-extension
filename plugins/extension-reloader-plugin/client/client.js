const serverWebsocketUrl = `ws://localhost:{{port}}`;

const consoleFns = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};
let websocket;

function configureConsole(consoleOptions) {
  for (const level of consoleOptions.captureLevels) {
    console[level] = (...args) => {
      // Call the original console function as if we weren't intercepting it, so that messages still appear in the console as normal
      consoleFns[level](...args);

      if (consoleOptions.ignoreMessage(...args)) {
        return;
      }

      websocket.send(JSON.stringify({ type: "log", level, data: args }));
    };
  }
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

function connect() {
  try {
    websocket = new WebSocket(serverWebsocketUrl);
  } catch {
    console.warn("Unable to connect, retrying in 1s...");
    setTimeout(connect, 1000);
    return;
  }

  const handleMessageEvent = (/** @type {MessageEvent} */ messageEvent) => {
    const message = JSON.parse(messageEvent.data);

    switch (message.type) {
      case "configure": {
        const config = message.data.config ?? {};

        if (config.consoleOptions != null) {
          configureConsole({
            captureLevels: config.consoleOptions?.captureLevels ?? [
              "log",
              "info",
              "warn",
              "error",
            ],
            ignoreMessage:
              config.consoleOptions?.ignoreMessage ?? (() => false),
          });
        }

        configured = true;

        break;
      }
      case "reload": {
        reloadCSS();
        location.reload();
        break;
      }
      case "log": {
        consoleFns.log(message.data);
        break;
      }
    }
  };

  const handleCloseEvent = () => {
    console.warn("Connection closed, attempting to reconnect...");
    setTimeout(connect, 1000);
  };

  websocket.onmessage = handleMessageEvent;
  websocket.onclose = handleCloseEvent;
}

connect();
