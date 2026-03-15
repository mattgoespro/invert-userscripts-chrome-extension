export type ToastVariant = "info" | "warning" | "error";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
  dismissible: boolean;
};

export type ToastOptions = {
  variant: ToastVariant;
  message: string;
  duration?: number;
  dismissible?: boolean;
};
