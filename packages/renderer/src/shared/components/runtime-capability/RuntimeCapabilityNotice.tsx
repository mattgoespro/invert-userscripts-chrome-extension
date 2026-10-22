import { useEffect, useState } from "react";
import { Button } from "../button/Button";
import { Dialog } from "../dialog/Dialog";
export function RuntimeCapabilityNotice() {
  const version = Number(
    navigator.userAgent.match(/(?:Chrome|Chromium)\/([0-9]+)/)?.[1] ?? 138
  );
  const [ready, setReady] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        await chrome.userScripts.getScripts();
        setReady(true);
        setDismissed(false);
      } catch {
        setReady(false);
      }
    };
    void check();
    window.addEventListener("focus", check);
    const timer = setInterval(check, 5000);
    return () => {
      window.removeEventListener("focus", check);
      clearInterval(timer);
    };
  }, []);
  return (
    <Dialog
      open={!ready && !dismissed}
      onClose={() => setDismissed(true)}
      title="Enable User Scripts"
      className="w-[min(28rem,calc(100vw-32px))]"
      dismissOnBackdrop={false}
    >
      <p className="font-body text-base leading-relaxed text-text-muted">
        {version >= 138
          ? "To run your scripts, enable Allow User Scripts in Chrome’s extension details."
          : "To run your scripts, enable Developer mode on Chrome’s Extensions page."}
      </p>
      <p className="mt-sm font-body text-base leading-relaxed text-text-muted">
        Return here after enabling it. This message closes automatically.
      </p>
      <div className="mt-lg flex flex-wrap items-center justify-end gap-sm">
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Continue editing
        </Button>
        <Button
          variant="secondary"
          autoFocus
          onClick={() =>
            void chrome.tabs.create({
              url: "chrome://extensions/?id=" + chrome.runtime.id,
            })
          }
        >
          Open extension details
        </Button>
      </div>
    </Dialog>
  );
}
