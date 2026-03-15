import "./Toast.scss";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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

  return (
    <div
      className={`toast toast--${variant} ${dismissing ? "toast--exit" : "toast--enter"}`}
      role="alert"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="toast--accent-bar" />

      <div className="toast--body">
        <div className="toast--content">
          <span className="toast--prefix">
            <span className="toast--prefix-slash">//</span>
            <span
              className={`toast--prefix-label toast--prefix-label--${variant}`}
            >
              {variantLabel[variant]}
            </span>
          </span>
          <span className="toast--message">{toast.message}</span>
        </div>

        {toast.dismissible && (
          <button
            className="toast--dismiss"
            onClick={startDismiss}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {toast.duration > 0 && (
        <div className="toast--progress-track">
          <div
            className="toast--progress-bar"
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}
