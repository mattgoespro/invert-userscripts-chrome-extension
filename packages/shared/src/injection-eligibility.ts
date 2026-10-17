/** URL eligibility only: Chrome still enforces host permissions and file access. */
export function isInjectablePage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "file:"].includes(parsed.protocol)) {
      return false;
    }
    return !(
      parsed.hostname === "chromewebstore.google.com" ||
      (parsed.hostname === "chrome.google.com" &&
        (parsed.pathname === "/webstore" ||
          parsed.pathname.startsWith("/webstore/")))
    );
  } catch {
    return false;
  }
}
