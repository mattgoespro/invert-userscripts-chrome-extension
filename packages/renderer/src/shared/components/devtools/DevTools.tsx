import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { DevToolsItem } from "./devtools-item/DevToolsItem";
import { StoragePreview } from "./storage-preview/StoragePreview";
import clsx from "clsx";

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
      className="fixed z-9999 font-mono"
      style={{ left: position.x, bottom: position.y }}
    >
      <button
        className={clsx(
          "flex items-center justify-center w-8 h-8 p-0",
          "border border-border rounded-default bg-surface-raised text-text-muted",
          "cursor-grab touch-none select-none transition-colors duration-150",
          "hover:border-accent-border hover:text-foreground",
          "active:cursor-grabbing",
          open && "border-accent-border text-accent bg-accent-subtle"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="DevTools"
      >
        <Wrench size={14} />
      </button>

      {open && (
        <div
          className={clsx(
            "absolute bottom-[calc(100%+8px)] left-0 min-w-60",
            "flex flex-col bg-surface-raised border border-border rounded-default",
            "overflow-hidden animate-devtools-reveal"
          )}
        >
          <div className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted-strong border-b border-border-subtle">
            <span className="text-text-muted-faint font-normal">{"// "}</span>
            devtools
          </div>
          <div className="flex flex-col p-1.5 gap-0.5">
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
