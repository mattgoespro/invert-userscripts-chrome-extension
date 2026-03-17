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
    <div className="fixed bottom-xl right-xl z-9999 flex flex-col gap-sm pointer-events-none">
      {toasts.map((item) => (
        <Toast key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
