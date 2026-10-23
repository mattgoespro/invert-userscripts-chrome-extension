import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cva } from "class-variance-authority";
import clsx from "clsx";
import type { ToastItem, ToastVariant } from "./model";
import { IconButton } from "../icon-button/IconButton";

type ToastProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

const toastVariants = cva(
  "relative flex flex-col min-w-70 max-w-90 border rounded-default bg-surface-raised shadow-(--toast-shadow) overflow-hidden pointer-events-auto",
  {
    variants: {
      variant: {
        info: "border-toast-info-border",
        warning: "border-toast-warning-border",
        error: "border-toast-error-border",
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
  info: "Info",
  warning: "Warning",
  error: "Error",
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

      <div className="flex items-start gap-sm py-sm pr-md pl-[calc(var(--spacing-md)+3px)]">
        <div className="flex min-w-0 flex-1 flex-col gap-2xs">
          <span className="inline-flex items-center text-xs leading-[1.4] font-semibold select-none">
            <span className={variantLabelColor[variant]}>
              {variantLabel[variant]}
            </span>
          </span>
          <span className="text-base leading-normal wrap-break-word text-toast-fg">
            {toast.message}
          </span>
        </div>

        {toast.dismissible && (
          <IconButton
            icon={X}
            size="sm"
            variant="ghost"
            onClick={startDismiss}
            aria-label="Dismiss"
          />
        )}
      </div>

      {toast.duration > 0 && (
        <div className="h-0.5 bg-transparent">
          <div
            className={clsx(
              "h-full w-full origin-left animate-toast-drain opacity-60",
              variantAccent[variant]
            )}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}
