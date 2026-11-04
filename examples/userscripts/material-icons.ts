/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
/**
 * Attaches the Material Icons font family link to the page.
 */
function linkMaterialIcons(): void {
  const link = document.createElement("link");
  link.href =
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";

  link.rel = "stylesheet";
  document.head.appendChild(link);
}

/**
 * Creates and returns an icon element.
 *
 * @param name the Material Icon name
 * @param size the icon size (no unit suffix)
 * @param color the icon color
 */
function createIcon(
  name: string,
  size: number = 18,
  color: string = "white"
): HTMLSpanElement {
  const span = document.createElement("span");
  span.classList.add("material-symbols-outlined", `md-${size}`);
  // The `md-*` size classes only target `.material-icons`, so size the symbol inline.
  span.style.fontSize = `${size}px`;
  span.style.color = color;
  span.innerText = name;
  return span;
}
