declare global {
  type HTMLButtonOnClick = HTMLButtonElement["onclick"];

  type UseButtonOnClickCallback = (
    button: HTMLButtonElement
  ) => HTMLButtonOnClick;

  interface UseButtonOptions {
    onClickFn?: UseButtonOnClickCallback | HTMLButtonOnClick;
    classes?: string[];
    disabled?: boolean;
    data?: Record<string, unknown>;
  }

  interface UseButtonUpdateData {
    data?: Record<string, unknown>;
    updateText?: (button: HTMLButtonElement) => string;
    onClickFn?: UseButtonOptions["onClickFn"];
    disabled?: boolean;
  }

  function useButton(
    text: string,
    options: UseButtonOptions
  ): [HTMLButtonElement, rxjs.Subject<UseButtonUpdateData>];

  function getDataAttributeObject(
    element: HTMLElement
  ): Record<string, unknown>;

  function setDataAttributeObject(
    element: HTMLElement,
    data: Record<string, unknown>
  ): void;
}

export {};
