declare global {
  interface Window {
    log: Logger;
    toaster: ReturnType<typeof createToaster> | null;
  }

  namespace rxjs {
    class Subject<T> {
      subscribe(callback: (value: T) => void): void;
      next(value: T): void;
    }
  }
}

export {};
