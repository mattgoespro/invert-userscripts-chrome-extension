import { Button } from "@/shared/components/button/Button";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import {
  Panel,
  PanelHeader,
  PanelSection,
} from "@/shared/components/panel/Panel";
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react";
import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ScriptListSort } from "@shared/storage";

type ScriptsActionsMenuProps = {
  sortBy: ScriptListSort;
  onSortChange: (value: ScriptListSort) => void;
  onImportClick: () => void;
  onExportClick: () => void;
};

export function ScriptsActionsMenu({
  sortBy,
  onSortChange,
  onImportClick,
  onExportClick,
}: ScriptsActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);
  const sortId = useId();
  const menuId = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      wrapperRef.current &&
      !wrapperRef.current.contains(event.target as Node) &&
      !menuRef.current?.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const updatePosition = (): void => {
      if (!triggerRef.current || !menuRef.current) {
        return;
      }
      const anchor = triggerRef.current.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = menuRef.current;
      const gap = 8;
      const alignedRight = anchor.right - width;
      const left = Math.max(
        gap,
        Math.min(
          alignedRight >= gap ? alignedRight : anchor.left,
          window.innerWidth - width - gap
        )
      );
      const below = anchor.bottom + gap;
      const top = Math.max(
        gap,
        below + height <= window.innerHeight - gap
          ? below
          : anchor.top - height - gap
      );
      setPosition((current) =>
        current?.left === left && current.top === top ? current : { left, top }
      );
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(menuRef.current!);
    const sidebar = wrapperRef.current?.closest(
      '[data-testid="scripts-sidebar"]'
    );
    if (sidebar) {
      observer.observe(sidebar);
    }
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const positioned = position !== null;
  useEffect(() => {
    if (open && positioned) {
      sortRef.current?.focus();
    }
  }, [open, positioned]);

  useEffect(() => {
    if (!open) {
      return;
    }

    document.addEventListener("mousedown", handleClickOutside);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleFocusOutside = (event: FocusEvent): void => {
      if (
        !wrapperRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusOutside);
    };
  }, [open, handleClickOutside]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  };

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <IconButton
        ref={triggerRef}
        icon={EllipsisVerticalIcon}
        variant="ghost"
        size="sm"
        className={clsx(open && "bg-hover-overlay")}
        onClick={() => setOpen((current) => !current)}
        title="Script list options"
        aria-haspopup="dialog"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="dialog"
            aria-label="Script list options"
            className="fixed z-100 max-h-[calc(100dvh-1rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <Panel className="w-full" style={{ position: "static" }}>
              <PanelHeader>script list</PanelHeader>
              <PanelSection className="gap-sm">
                <div className="flex flex-col gap-xs">
                  <label
                    htmlFor={sortId}
                    className="text-xs text-text-muted-strong"
                  >
                    Sort by
                  </label>
                  <select
                    ref={sortRef}
                    id={sortId}
                    value={sortBy}
                    onChange={(event) =>
                      onSortChange(
                        event.target.value === "created" ? "created" : "name"
                      )
                    }
                    className="h-7 w-full rounded-default border border-border bg-surface-base px-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <option value="name">Name (default)</option>
                    <option value="created">Created</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => handleAction(onImportClick)}
                >
                  <UploadIcon size={12} />
                  Import
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => handleAction(onExportClick)}
                >
                  <DownloadIcon size={12} />
                  Export
                </Button>
              </PanelSection>
            </Panel>
          </div>,
          document.body
        )}
    </div>
  );
}
