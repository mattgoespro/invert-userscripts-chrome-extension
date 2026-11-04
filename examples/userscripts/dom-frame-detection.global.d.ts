declare global {
  interface HTMLIFrameElement {
    __primaryIframeScore?: number;
  }

  function isParentFrame(window: Window): boolean;

  function isEmbeddedFrame(window: Window): boolean;

  function containsEmbeddedFrame(): boolean;

  function findPrimaryIframe(): HTMLIFrameElement | null;
}

export {};
