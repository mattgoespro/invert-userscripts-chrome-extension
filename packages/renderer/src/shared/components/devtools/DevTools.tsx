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
        type="button"
        className={clsx(
          "flex size-(--button-height-lg) items-center justify-center p-0",
          "cursor-grab touch-none rounded-default transition-colors duration-150 select-none",
          "active:cursor-grabbing",
          open
            ? "border border-accent-border bg-accent-subtle text-accent"
            : "border border-border bg-surface-raised text-text-muted hover:border-accent-border hover:text-foreground"
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
            "flex flex-col rounded-default border border-border bg-surface-raised",
            "animate-devtools-reveal overflow-hidden"
          )}
        >
          <div className="border-b border-border-subtle px-3.5 py-2.5 text-[10px] font-semibold tracking-[0.06em] text-text-muted-strong uppercase">
            <span className="font-normal text-text-muted-faint">{"// "}</span>
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
