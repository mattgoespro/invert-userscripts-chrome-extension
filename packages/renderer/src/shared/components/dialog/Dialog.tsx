import { PropsWithChildren, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

type DialogProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  minWidth?: string;
}>;

export function Dialog({
  open,
  onClose,
  title,
  className,
  minWidth,
  children,
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-100 flex animate-backdrop-enter items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div
        className={clsx(
          "flex max-h-[80vh] animate-dialog-enter flex-col overflow-hidden",
          "rounded-default border border-accent-border bg-surface-overlay",
          "shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.2)]",
          className
        )}
        style={minWidth ? { minWidth } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-md py-sm">
          <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-text-muted-strong uppercase">
            {title}
          </span>
          <button
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-default border-none bg-transparent p-0 text-text-muted transition-colors duration-150 hover:bg-hover-overlay hover:text-foreground"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-md">
          {children}
        </div>
      </div>
    </div>
  );
}
