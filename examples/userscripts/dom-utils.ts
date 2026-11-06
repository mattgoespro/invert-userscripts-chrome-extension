/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
const log = createLogger("DOM Utils | Utility");

/**
 * On some pages, `window.open` could get modified during page loads, so cache its implementation
 * locally to use when the original implementation is needed.
 */
const openTabFn = window.open;

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  waitTime: 3e3,
  retryLimit: 10,
  retryMessage: "Retrying function...",
  timeoutMessage: "Retry limit reached.",
  log: true,
  throwError: true,
};

/**
 * Copy text to the clipboard.
 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

/**
 * Retry a function call until the function returns a non-null
 * result, or the call limit is reached.
 *
 * @param retryFn the function to retry
 * @param options retryOptions
 *   - waitTime: (optional) the time to wait between retries in seconds
 *       Default: 3s
 *   - retryLimit: (optional) the limit of the calls to the retry function
 *       Default: 10
 *   - retryMessage: (optional) the message to log on a retry
 *       Default: 'Retrying function...'
 *   - timeoutMessage: (optional) a message string to log if the execution
 *         limit is reached, or `false` to suppress log messages
 *       Default: 'Retry timed out.'
 *   - log: (optional) whether to suppress log messages
 *   - throwError: (optional) whether to throw an error when the retry limit is reached
 *       Default: true
 *
 * @returns the result of the function callback if resolved to
 *   a non-null value.
 */
async function retry<T>(
  retryFn: () => T | Promise<T>,
  options: RetryOptions = {}
) {
  const {
    waitTime,
    retryLimit,
    retryMessage,
    timeoutMessage,
    log: logMessages,
    throwError,
  } = { ...DEFAULT_RETRY_OPTIONS, ...options };

  const isUnresolved = (result: T) => result == null || result === false;

  let retryFnResult = await retryFn();
  let retries = 1;

  while (isUnresolved(retryFnResult) && retries < retryLimit) {
    await wait(waitTime);

    if (logMessages) {
      log.info(`${retryMessage}     [${retries}/${retryLimit}]`);
    }

    retryFnResult = await retryFn();
    retries++;
  }

  if (isUnresolved(retryFnResult)) {
    if (throwError) {
      throw new Error(log.createLogMessage(timeoutMessage));
    }

    if (logMessages) {
      log.warn(timeoutMessage);
    }

    return null;
  }

  return retryFnResult;
}

/**
 * Wait a specified amount of time until a certain condition is validated.
 *
 * @param conditionFn callback function that returns a truthy value
 * @param retryInterval the time to wait between conditional checks (ms)
 *
 */
async function waitUntil(
  conditionFn: () => boolean | Promise<boolean>,
  retryInterval: number
) {
  let condition = (await conditionFn()) ?? false;

  while (!condition) {
    await wait(retryInterval);
    condition = (await conditionFn()) ?? false;
  }
}

/**
 * Wait a specified time (ms).
 *
 * @param time the time to wait (ms)
 *
 * @returns a new Promise that resolves to `null`
 *   after the specified wait time.
 */
async function wait(time: number) {
  return new Promise((resolve) => setTimeout(() => resolve(null), time));
}

/**
 * Converts a space-separated string to a camel-case string.
 *
 * @returns the string as a camel-case.
 */
function convertToCamelCase(text: string): string {
  const [firstWord, ...restWords] = text.split(" ");
  const firstWordLetter = firstWord.charAt(0).toLowerCase();
  const restOfFirstWord = firstWord.slice(1);
  const restOfWords = restWords.join("");
  return [firstWordLetter, restOfFirstWord, restOfWords].join("");
}

/**
 * CSS styles object type
 */
interface CSSStylesObject {
  [key: string]: string | number;
}

/**
 * Add the properties of a CSS styles object to an element.
 *
 * @param element the element to apply the styles to
 * @param styles an object containing CSS property keys
 *   to their values
 *
 * @returns the element with the styles applied
 */
function addStyles(
  element: HTMLElement,
  styles: CSSStylesObject
): CSSStyleDeclaration {
  return Object.assign(element.style, styles);
}

/**
 * Create a banner at the bottom of the page containing the
 *  list of provided elements.
 *
 * @param elements the elements to add to the banner
 */
function createPageBanner(...elements: HTMLElement[]) {
  const banner = document.createElement("div");
  banner.classList.add("ujs-page-banner");

  elements.forEach((element) => banner.appendChild(element));

  return banner;
}

/**
 * Create a banner at the bottom of the page containing the
 *  list of provided elements.
 *
 * @param elements the elements to add to the banner
 */
function createPageSidebar(...elements: HTMLElement[]) {
  const banner = document.createElement("div");
  banner.classList.add("ujs-page-sidebar");

  elements.forEach((element) => banner.appendChild(element));

  return banner;
}

/**
 * Enables resizing from the bottom-right corner.
 * @param {HTMLDivElement} el
 */
function makeResizable(el: HTMLDivElement, parent: HTMLDivElement = el) {
  const resizer = document.createElement("div");
  resizer.classList.add("ujs-element-resizer");
  parent.appendChild(resizer);

  let startX: number, startY: number, startWidth: number, startHeight: number;

  const onMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.width = `${startWidth + dx}px`;
    el.style.height = `${startHeight + dy}px`;
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    // Pin the left edge so that a right-anchored element grows towards the cursor.
    el.style.left = `${el.getBoundingClientRect().left}px`;
    el.style.right = "auto";
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(getComputedStyle(el).width, 10);
    startHeight = parseInt(getComputedStyle(el).height, 10);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

/**
 * Enables drag-to-move by clicking and dragging on the header.
 * @param {HTMLDivElement} el The container element to move
 * @param {HTMLDivElement} handle The element that acts as the draggable handle
 */
function makeDraggable(el: HTMLDivElement, handle: HTMLDivElement) {
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;

  handle.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    isDragging = true;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
}

/**
 * Open the provided URL in a new tab.
 *
 * Typically used when `window.open` is not available in the
 * window context.
 *
 * @param url the URL to open in a new tab
 */
function openUrl(url: string) {
  if (openTabFn != null) {
    openTabFn.call(window, url, "_blank");
    log.info("Opened new tab with URL: ", url);
    return;
  }

  const { origin, pathname, searchParams } = new URL(url);

  const actionUrl = `${origin}${pathname}`;
  log.info(`Setting form action URL -> '${actionUrl}'`);

  const openUrlForm = document.createElement("form");
  openUrlForm.id = "open-url-form";
  openUrlForm.action = actionUrl;
  openUrlForm.rel = "prefetch";
  openUrlForm.method = "get";
  openUrlForm.target = "_blank";

  /**
   * Use hidden form input fields that set the URL query parameters
   * when the form is submitted.
   */
  for (const [paramName, paramValue] of Array.from(searchParams.entries())) {
    /**
     * TODO: May need to check if the value *needs* encoding, otherwise
     * don't encode.
     */
    const value = paramValue;

    log.info(
      `Creating hidden input field for query parameter: ${paramName}=${value}`
    );

    const paramInput = document.createElement("input");

    paramInput.type = "hidden";
    paramInput.name = paramName;
    paramInput.value = value;

    openUrlForm.appendChild(paramInput);
  }

  document.body.appendChild(openUrlForm);

  openUrlForm.submit();

  document.body.removeChild(openUrlForm);
}

/**
 * Wait until a global module has loaded.
 *
 * @param getModule reads the module on every check, so a module that loads
 *   after the call is still picked up
 */
async function waitForModule(getModule: () => unknown) {
  await retry(() => getModule() != null);
}

/**
 * Inject Google font families into the page.
 *
 * @param fontFamilies the list of Google fonts families
 * to inject into the page.
 */
async function injectFonts(...fontFamilies: string[]) {
  await waitForModule(() => (window as Window & { WebFont?: unknown }).WebFont);

  // @ts-expect-error - WebFont is loaded globally from CDN and does not have types
  WebFont.load({
    google: {
      families: fontFamilies,
    },
  });
}

function loadDomUtils() {
  createLogger("DOM Utils | Utility");
}

loadDomUtils();
