import { DefaultAppTheme, resolveAppTheme } from "@shared/constants";

/** Applies an app theme to the document. The default theme lives on :root. */
export function applyAppTheme(themeId: string | undefined): void {
  const root = document.documentElement;
  const theme = resolveAppTheme(themeId);

  if (theme === DefaultAppTheme) {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}
