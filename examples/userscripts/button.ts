/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
window.log = createLogger("Button | DOM Components");

/**
 * Create a button of the specified type.
 *
 *  @param type the type of button, either a vanilla button
 *    or an anchor with the `button` role attribute
 *  @param options options to populate the button attributes:
 *		- `text`: the button text
 *    - `onClickFn`: a callback that provides the button to the
 *        consumer and returns a new callback for the button click
 *    - `disabled`: (optional) whether the button starts off disabled
 *		- `href`: (optional) the target url of a link button
 *    - `classes`: (optional) list of additional css classes to apply
 */
function useButton(
  text: string,
  { onClickFn, classes, disabled, data }: UseButtonOptions
): [HTMLButtonElement, UseButtonUpdateFn] {
  const button = document.createElement("button");
  button.id = convertToCamelCase(text);
  button.classList.add(...(classes ?? []), "ujs-button");
  button.innerText = text;
  button.disabled = disabled ?? false;

  const buttonCustomDataAttr = document.createAttribute("data");
  button.setAttributeNode(buttonCustomDataAttr);
  button.setAttribute("data", JSON.stringify({ text, ...data }));

  button.onclick = (event) => {
    // When the consumer requires an instance of the button before it has been
    // initialized, a new callback function without parameters must be returned,
    // so we add the return value of the provided callback function as the click listener.
    if (onClickFn == null) {
      window.log.warn("No click listener provided.");
      return;
    }

    const result = (onClickFn as UseButtonOnClickCallback)(button);

    if (typeof result === "function") {
      result.call(button, event);
    }
  };

  const updateButton = (updateData: UseButtonUpdateData) => {
    applyButtonUpdate(button, updateData);
  };

  return [button, updateButton];
}

function applyButtonUpdate(
  button: HTMLButtonElement,
  updateData: UseButtonUpdateData
) {
  const {
    data: updateEventData,
    updateText,
    onClickFn: updateEventOnClickFn,
    disabled: updateEventDisabled,
  } = updateData;

  if (updateEventDisabled != null) {
    button.disabled = updateEventDisabled;
  }

  if (updateText != null) {
    button.innerText = updateText(button);
  }

  button.onclick =
    updateEventOnClickFn != null
      ? updateEventOnClickFn.bind(button)
      : button.onclick;

  const currentData = getDataAttributeObject(button);
  const updatedData = { ...currentData, ...updateEventData };
  setDataAttributeObject(button, updatedData);
}

/**
 * Parses the custom `data` attribute value of an element to
 * a plain object. If the value is undefined, returns an
 * empty object
 *
 * @param element the element with the `data` attribute
 */
function getDataAttributeObject(element: HTMLElement): Record<string, unknown> {
  const val = element.getAttribute("data");

  if (val == null) {
    return {};
  }

  return JSON.parse(val);
}

/**
 * Sets the stringified `data` attribute value of
 * an element.
 */
function setDataAttributeObject(
  element: HTMLElement,
  data: Record<string, unknown>
): void {
  element.setAttribute("data", JSON.stringify(data));
}

function createIconButton(
  icon: string,
  {
    onClickFn,
  }: { onClickFn: (this: HTMLButtonElement, event: MouseEvent) => void }
) {
  // Create an icon button with the specified Material Icon
  const iconBtn = document.createElement("button");
  iconBtn.classList.add("material-symbols-outlined", "ujs-close-btn");
  iconBtn.innerText = icon;
  iconBtn.addEventListener("click", onClickFn);
  return iconBtn;
}
