interface DialogPointerEvent {
  target: unknown;
  currentTarget: {
    getBoundingClientRect(): {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
  };
  clientX: number;
  clientY: number;
}

/** Backdrop events target the dialog itself but land outside its box. */
export function isBackdropPointer(event: DialogPointerEvent): boolean {
  if (event.target !== event.currentTarget) {
    return false;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}
