import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cva } from "class-variance-authority";
import clsx from "clsx";
import type { ToastItem, ToastVariant } from "./model";

type ToastProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

const toastVariants = cva(
  "relative flex flex-col min-w-70 max-w-90 border rounded-default shadow-(--toast-shadow) overflow-hidden pointer-events-auto",
  {
    variants: {
      variant: {
        info: "bg-toast-info-surface border-toast-info-border",
        warning: "bg-toast-warning-surface border-toast-warning-border",
        error: "bg-toast-error-surface border-toast-error-border",
      },
      dismissing: {
        true: "animate-toast-slide-out",
        false: "animate-toast-slide-in",
      },
    },
    defaultVariants: {
      variant: "info",
      dismissing: false,
    },
  }
);

const variantLabel: Record<ToastVariant, string> = {
  info: "info",
  warning: "warn",
  error: "error",
};

const variantAccent: Record<ToastVariant, string> = {
  info: "bg-toast-info-accent",
  warning: "bg-toast-warning-accent",
  error: "bg-toast-error-accent",
};

const variantLabelColor: Record<ToastVariant, string> = {
  info: "text-toast-info-accent",
  warning: "text-toast-warning-accent",
  error: "text-toast-error-accent",
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  return (
    <div
      className={toastVariants({ variant, dismissing })}
      role="alert"
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className={clsx(
          "absolute top-0 bottom-0 left-0 w-0.75",
          variantAccent[variant]
        )}
      />

      <div className="gap-sm py-sm pr-md flex items-start pl-[calc(var(--spacing-md)+3px)]">
        <div className="gap-2xs flex min-w-0 flex-1 flex-col">
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] leading-[1.4] font-medium tracking-[0.02em] uppercase select-none">
            <span className="text-syntax-comment italic opacity-60">//</span>
            <span className={variantLabelColor[variant]}>
              {variantLabel[variant]}
            </span>
          </span>
          <span className="text-toast-fg font-mono text-xs leading-normal wrap-break-word">
            {toast.message}
          </span>
        </div>

        {toast.dismissible && (
          <button
            className="rounded-default text-text-muted hover:text-foreground hover:bg-hover-overlay mt-px flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[color,background-color] duration-150"
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
              "animate-toast-drain h-full w-full origin-left opacity-60",
              variantAccent[variant]
            )}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}
