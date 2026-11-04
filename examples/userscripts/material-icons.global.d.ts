declare global {
  function linkMaterialIcons(): void;

  function createIcon(
    name: string,
    size?: number,
    color?: string
  ): HTMLSpanElement;
}

export {};
