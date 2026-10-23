import { PropsWithChildren, useEffect, useRef } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "../icon-button/IconButton";

type DialogProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  minWidth?: string;
  dismissOnBackdrop?: boolean;
}>;

export function Dialog({
  open,
  onClose,
  title,
  className,
  minWidth,
  dismissOnBackdrop = true,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) {
      return;
    }
    // Native modality covers the viewport, traps focus, and makes the page inert.
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className={clsx(
        "fixed inset-0 m-auto flex max-h-[80dvh] max-w-[calc(100vw-32px)] flex-col overflow-hidden p-0 text-foreground",
        "rounded-panel border border-border bg-surface-raised shadow-(--dialog-shadow) backdrop:bg-scrim",
        className
      )}
      style={
        minWidth
          ? { minWidth: `min(${minWidth}, calc(100vw - 32px))` }
          : undefined
      }
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (!dismissOnBackdrop || event.target !== event.currentTarget) {
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-lg py-md">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <IconButton
          icon={X}
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label="Close dialog"
        />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto p-lg">
        {children}
      </div>
    </dialog>
  );
}
