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
          "flex h-8 w-8 items-center justify-center p-0",
          "rounded-default cursor-grab touch-none transition-colors duration-150 select-none",
          "active:cursor-grabbing",
          open
            ? "border-accent-border text-accent bg-accent-subtle border"
            : "border-border bg-surface-raised text-text-muted hover:border-accent-border hover:text-foreground border"
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
            "bg-surface-raised border-border rounded-default flex flex-col border",
            "animate-devtools-reveal overflow-hidden"
          )}
        >
          <div className="text-text-muted-strong border-border-subtle border-b px-3.5 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase">
            <span className="text-text-muted-faint font-normal">{"// "}</span>
            devtools
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
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
