declare global {
  type RetryOptions = {
    waitTime?: number;
    retryLimit?: number;
    retryMessage?: string;
    timeoutMessage?: string;
    log?: boolean;
    throwError?: boolean;
  };

  function retry<T>(retryFn: () => T, options?: RetryOptions): T;

  function convertToCamelCase(str: string): string;

  function isParentFrame(window: Window): boolean;

  function isEmbeddedFrame(window: Window): boolean;

  function containsEmbeddedFrame(): boolean;

  function createPageBanner(...elements: HTMLElement[]): HTMLElement;

  function makeResizable(element: HTMLElement, handle: HTMLElement): void;

  function makeDraggable(element: HTMLElement, handle: HTMLElement): void;

  function openUrl(url: string): void;

  function linkMaterialFonts(): void;

  function injectFonts(...families: string[]): void;
}

export {};
