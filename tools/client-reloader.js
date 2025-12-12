(function () {
  let ws;
  let retryInterval;

  function connect() {
    if (ws) return;
    ws = new WebSocket('ws://localhost:{{websocketPort}}');

    ws.onopen = () => {
      console.log('[ChromeExtensionReloaderWebpackPlugin] Connected to build server');
      if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
      }
    };

    ws.onmessage = (event) => {
      if (event.data === 'reload') {
        console.log('[ChromeExtensionReloaderWebpackPlugin] Reloading extension...');
        chrome.runtime.reload();
      }
    };

    ws.onclose = () => {
      ws = null;
      console.log('[ChromeExtensionReloaderWebpackPlugin] Disconnected. Retrying in 1s...');
      if (!retryInterval) {
        retryInterval = setInterval(connect, 1000);
      }
    };

    ws.onerror = (err) => {
      console.error('[ChromeExtensionReloaderWebpackPlugin] WebSocket error:', err);
      ws.close(); // Ensure close is called to trigger retry
    };
  }

  connect();

  // Keep-alive for service worker
  setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
})();
