declare global {
  interface Window {
    log: Logger;
    toaster: ReturnType<typeof createToaster>;
  }
}

export {};
