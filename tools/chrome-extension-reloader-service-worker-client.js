let retryInterval;
let retryCount = 0;
let maxRetries = 10;

let webSocket = null;

function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () => {
      if (webSocket) {
        webSocket.send('keepalive');
      } else {
        clearInterval(keepAliveIntervalId);
      }
    },
    // Set the interval to 20 seconds to prevent the service worker from becoming inactive.
    20 * 1000
  );
}

function connect() {
  webSocket = new WebSocket('ws://localhost:{{websocketPort}}');

  webSocket.onopen = (_event) => {
    console.log('[ChromeExtensionReloaderWebpackPlugin] Connected to reloader plugin.');

    keepAlive();
  };

  webSocket.onmessage = (event) => {
    if (event.data === 'reload') {
      console.log('[ChromeExtensionReloaderWebpackPlugin] Reloading extension...');
      chrome.runtime.reload();
    }
  };

  webSocket.onclose = (_event) => {
    webSocket = null;

    if (!retryInterval && retryCount < maxRetries) {
      retryInterval = setInterval(connect, 1000);
      retryCount++;
    }
  };
}

function disconnect() {
  if (webSocket == null) {
    return;
  }

  webSocket.close();
}

connect();
