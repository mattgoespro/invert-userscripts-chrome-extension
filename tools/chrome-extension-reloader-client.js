(() => {
  const WS_PORT = `{{port}}`;
  const WS_URL = 'ws://localhost:' + WS_PORT;

  function snapshot() {
    return {
      url: location.href,
      scroll: { x: window.scrollX, y: window.scrollY },
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map((el) => ({
        id: el.id || null,
        name: el.name || null,
        value: 'value' in el ? el.value : null,
        checked: 'checked' in el ? el.checked : null,
      })),
    };
  }

  function restore(state) {
    if (!state) return;
    requestAnimationFrame(() => {
      window.scrollTo(state.scroll.x, state.scroll.y);
      for (const i of state.inputs) {
        const el =
          (i.id && document.getElementById(i.id)) ||
          (i.name && document.querySelector('[name="' + i.name + '"]'));
        if (!el) continue;
        if ('checked' in el && i.checked !== null) el.checked = i.checked;
        if ('value' in el && i.value !== null) el.value = i.value;
      }
    });
  }

  function reloadCSS() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;
      const clean = href.split('?')[0];
      link.setAttribute('href', clean + '?t=' + Date.now());
    }
  }

  function saveSnapshotAndReload() {
    try {
      sessionStorage.setItem('__chrome_ext_snapshot__', JSON.stringify(snapshot()));
    } catch {}
    location.reload();
  }

  function restoreIfPresent() {
    const raw = sessionStorage.getItem('__chrome_ext_snapshot__');
    if (!raw) return;
    sessionStorage.removeItem('__chrome_ext_snapshot__');
    try {
      restore(JSON.parse(raw));
    } catch {}
  }

  function connect() {
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      setTimeout(connect, 1000);
      return;
    }

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== 'reload') return;

      reloadCSS();
      saveSnapshotAndReload();
    };

    ws.onclose = () => setTimeout(connect, 1000);
    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreIfPresent);
  } else {
    restoreIfPresent();
  }

  connect();
})();
