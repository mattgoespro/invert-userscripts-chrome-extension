import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import type { ToastItem, ToastVariant } from "./model";

type ToastProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

const variantLabel: Record<ToastVariant, string> = {
  info: "info",
  warning: "warn",
  error: "error",
};

const variantStyles: Record<
  ToastVariant,
  { bg: string; border: string; accent: string; label: string }
> = {
  info: {
    bg: "bg-toast-info-surface",
    border: "border-toast-info-border",
    accent: "bg-toast-info-accent",
    label: "text-toast-info-accent",
  },
  warning: {
    bg: "bg-toast-warning-surface",
    border: "border-toast-warning-border",
    accent: "bg-toast-warning-accent",
    label: "text-toast-warning-accent",
  },
  error: {
    bg: "bg-toast-error-surface",
    border: "border-toast-error-border",
    accent: "bg-toast-error-accent",
    label: "text-toast-error-accent",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismiss = useCallback(() => {
    setDismissing(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (dismissing) {
      onDismiss(toast.id);
    }
  }, [dismissing, onDismiss, toast.id]);

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(startDismiss, toast.duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration, startDismiss]);

  const variant = toast.variant;
  const vs = variantStyles[variant];

  return (
    <div
      className={clsx(
        "relative flex flex-col min-w-70 max-w-90",
        "border rounded-default",
        "shadow-(--toast-shadow) overflow-hidden pointer-events-auto",
        vs.bg,
        vs.border,
        dismissing ? "animate-toast-slide-out" : "animate-toast-slide-in"
      )}
      role="alert"
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className={clsx("absolute top-0 left-0 bottom-0 w-0.75", vs.accent)}
      />

      <div className="flex items-start gap-sm py-sm pr-md pl-[calc(var(--spacing-md)+3px)]">
        <div className="flex flex-col gap-2xs flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium leading-[1.4] tracking-[0.02em] uppercase select-none">
            <span className="text-syntax-comment italic opacity-60">//</span>
            <span className={vs.label}>{variantLabel[variant]}</span>
          </span>
          <span className="font-mono text-xs leading-normal text-toast-fg wrap-break-word">
            {toast.message}
          </span>
        </div>

        {toast.dismissible && (
          <button
            className="flex items-center justify-center shrink-0 w-5 h-5 mt-px p-0 bg-transparent border-none rounded-default text-text-muted cursor-pointer transition-[color,background-color] duration-150 hover:text-foreground hover:bg-hover-overlay"
            onClick={startDismiss}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {toast.duration > 0 && (
        <div className="h-0.5 bg-transparent">
          <div
            className={clsx(
              "h-full w-full origin-left animate-toast-drain opacity-60",
              vs.accent
            )}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}
