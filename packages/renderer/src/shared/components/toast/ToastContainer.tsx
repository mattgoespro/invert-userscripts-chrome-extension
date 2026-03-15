import { Toast } from "./Toast";
import type { ToastItem } from "./model";

type ToastContainerProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((item) => (
        <Toast key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
