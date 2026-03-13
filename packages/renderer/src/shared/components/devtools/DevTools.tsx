import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { DevToolsItem } from "./devtools-item/DevToolsItem";
import { StoragePreview } from "./storage-preview/StoragePreview";
import "./DevTools.scss";

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A floating devtools menu with developer utilities for debugging the extension.
 *
 * Include in the application when needed.
 */
export function DevTools() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      dragging.current = true;
      hasMoved.current = false;
      dragOffset.current = {
        x: event.clientX - position.x,
        y: event.clientY - (window.innerHeight - position.y),
      };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [position]
  );

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragging.current) return;
    hasMoved.current = true;

    const newX = clamp(
      event.clientX - dragOffset.current.x,
      0,
      window.innerWidth - 40
    );
    const newY = clamp(
      window.innerHeight - (event.clientY - dragOffset.current.y),
      0,
      window.innerHeight - 40
    );
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    if (!hasMoved.current) {
      setOpen((prev) => !prev);
    }
  }, []);

  /** Close the menu when clicking outside */
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="app-dev-tools"
      style={{ left: position.x, bottom: position.y }}
    >
      <button
        className={
          "app-dev-tools--trigger" +
          (open ? " app-dev-tools--trigger-active" : "")
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="DevTools"
      >
        <Wrench size={14} />
      </button>

      {open && (
        <div className="app-dev-tools--menu">
          <div className="app-dev-tools--menu-header">
            <span className="app-dev-tools--menu-prefix">{"// "}</span>
            devtools
          </div>
          <div className="app-dev-tools--menu-items">
            <DevToolsItem
              name="chrome.storage.sync"
              panel={<StoragePreview />}
              panelTitle="devtools: storage inspector"
            />
          </div>
        </div>
      )}
    </div>
  );
}
