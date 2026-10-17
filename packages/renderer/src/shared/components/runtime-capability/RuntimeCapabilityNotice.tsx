import { useEffect, useState } from "react";
import { Button } from "../button/Button";
export function RuntimeCapabilityNotice() {
  const version = Number(
    navigator.userAgent.match(/(?:Chrome|Chromium)\/([0-9]+)/)?.[1] ?? 138
  );
  const [ready, setReady] = useState(true);
  useEffect(() => {
    const check = async () => {
      try {
        await chrome.userScripts.getScripts();
        setReady(true);
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
  if (ready) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-sm border-b border-border bg-surface-raised p-md text-sm text-text-muted-strong"
    >
      <span>
        {version >= 138
          ? "To run your scripts, enable Allow User Scripts in Chrome’s extension details."
          : "To run your scripts, enable Developer mode on Chrome’s Extensions page."}
      </span>
      <Button
        variant="secondary"
        onClick={() =>
          void chrome.tabs.create({
            url: "chrome://extensions/?id=" + chrome.runtime.id,
          })
        }
      >
        Open extension details
      </Button>
    </div>
  );
}
