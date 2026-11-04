/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
/**
 * Check if the current window is the parent (top) frame.
 *
 * @param window the window object
 */
function isParentFrame(window: Window): boolean {
  return window === window.parent;
}

/**
 * Check if the current window is embedded within another frame.
 * @param window the window object
 */
function isEmbeddedFrame(window: Window): boolean {
  return window !== window.parent;
}

/**
 * Check if the current window contains an embedded frame.
 */
function containsEmbeddedFrame(): boolean {
  return findPrimaryIframe() != null;
}

/**
 * Finds and returns the iframe HTML element most likely to contain the page's primary content (eg. an embedded video).
 */
function findPrimaryIframe(): HTMLIFrameElement | null {
  const iframes = Array.from(document.querySelectorAll("iframe"));

  if (iframes.length === 0) {
    return null;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportArea = viewportWidth * viewportHeight;
  const viewportCenterX = viewportWidth / 2;
  const viewportCenterY = viewportHeight / 2;

  const POSITIVE_HINTS = [
    "viewer",
    "document",
    "pdf",
    "content",
    "player",
    "video",
    "media",
    "embed",
    "interactive",
    "app",
    "application",
    "dashboard",
    "editor",
    "workspace",
    "canvas",
    "map",
    "form",
    "report",
    "presentation",
    "article",
    "reader",
  ];

  const NEGATIVE_HINTS = [
    "ad",
    "ads",
    "advert",
    "advertisement",
    "banner",
    "promo",
    "sponsor",
    "sponsored",
    "doubleclick",
    "googlesyndication",
    "adservice",
    "taboola",
    "outbrain",
    "criteo",
    "amazon-adsystem",
    "adsystem",
    "adsafe",
    "prebid",
    "yield",
    "tracking",
    "tracker",
    "analytics",
    "beacon",
    "pixel",
    "consent",
    "gdpr",
    "cmp",
    "cookie",
    "chat",
    "intercom",
    "drift",
    "zendesk",
    "crisp",
    "widget",
    "floating",
    "overlay",
    "popup",
    "modal",
    "subscribe",
    "newsletter",
    "share",
    "social",
    "feedback",
    "survey",
    "notification",
  ];

  /**
   * Hints this short also appear inside unrelated words ("ad" in "header",
   * "app" in "happy"), so they only match as whole words.
   */
  const WHOLE_WORD_HINT_MAX_LENGTH = 3;

  function tokenize(value: unknown): string {
    return String(value || "").toLowerCase();
  }

  function containsHint(text: string, hints: string[]): boolean {
    const words = text.split(/[^a-z0-9]+/);

    return hints.some((h) =>
      h.length <= WHOLE_WORD_HINT_MAX_LENGTH
        ? words.includes(h)
        : text.includes(h)
    );
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function visibleRect(rect: DOMRect): { width: number; height: number } {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewportWidth, rect.right);
    const bottom = Math.min(viewportHeight, rect.bottom);

    return {
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  const metrics: {
    iframe: HTMLIFrameElement;
    rect: DOMRect;
    area: number;
    visibleArea: number;
  }[] = [];

  let maxArea = 1;
  let maxVisibleArea = 1;

  for (const iframe of iframes) {
    const rect = iframe.getBoundingClientRect();
    const visible = visibleRect(rect);

    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const visibleArea = visible.width * visible.height;

    maxArea = Math.max(maxArea, area);
    maxVisibleArea = Math.max(maxVisibleArea, visibleArea);

    metrics.push({
      iframe,
      rect,
      area,
      visibleArea,
    });
  }

  let best: HTMLIFrameElement | null = null;
  let bestScore = -Infinity;

  for (const { iframe, rect, area, visibleArea } of metrics) {
    let score = 0;

    const style = getComputedStyle(iframe);

    const visibleFraction = area > 0 ? visibleArea / area : 0;
    const relativeArea = area / maxArea;
    const relativeVisibleArea = visibleArea / maxVisibleArea;

    //
    // Relative size (largest signal)
    //
    score += relativeArea * 45;
    score += relativeVisibleArea * 35;

    //
    // Occupies significant viewport area
    //
    const viewportCoverage = visibleArea / viewportArea;
    score += Math.min(viewportCoverage * 120, 30);

    //
    // Visibility
    //
    if (visibleArea > 0) {
      score += 20;
    }

    score += visibleFraction * 20;

    //
    // Viewport center proximity
    //
    if (visibleArea > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = cx - viewportCenterX;
      const dy = cy - viewportCenterY;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance =
        Math.sqrt(
          viewportWidth * viewportWidth + viewportHeight * viewportHeight
        ) / 2;

      score += (1 - clamp(distance / maxDistance, 0, 1)) * 20;
    }

    //
    // Size penalties
    //
    if (rect.width < 50 || rect.height < 50) score -= 40;
    if (rect.width < 100 || rect.height < 80) score -= 20;
    if (area < 5000) score -= 25;
    if (visibleArea < 2000) score -= 20;

    //
    // Hidden
    //
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) === 0
    ) {
      score -= 100;
    }

    //
    // Fixed overlay detection
    //
    if (style.position === "fixed") {
      score -= 40;

      const z = parseInt(style.zIndex, 10);
      if (!Number.isNaN(z) && z >= 1000) {
        score -= 40;
      }
    }

    //
    // Attribute/content hints
    //
    const text = [
      iframe.id,
      iframe.className,
      iframe.name,
      iframe.title,
      iframe.src,
    ]
      .map(tokenize)
      .join(" ");

    if (containsHint(text, POSITIVE_HINTS)) score += 12;
    if (containsHint(text, NEGATIVE_HINTS)) score -= 35;

    //
    // Ancestor inspection
    //
    let ancestor = iframe.parentElement;
    let depth = 0;

    while (ancestor && depth < 6) {
      const ancestorStyle = getComputedStyle(ancestor);

      const ancestorText = [
        ancestor.id,
        ancestor.className,
        ancestor.getAttribute("role"),
        ancestor.getAttribute("aria-label"),
        ancestor.getAttribute("data-testid"),
        ancestor.getAttribute("data-test"),
      ]
        .map(tokenize)
        .join(" ");

      if (containsHint(ancestorText, POSITIVE_HINTS)) {
        score += 6;
      }

      if (containsHint(ancestorText, NEGATIVE_HINTS)) {
        score -= 20;
      }

      if (ancestorStyle.position === "fixed") {
        score -= 15;

        const z = parseInt(ancestorStyle.zIndex, 10);
        if (!Number.isNaN(z) && z >= 1000) {
          score -= 20;
        }
      }

      ancestor = ancestor.parentElement;
      depth++;
    }

    //
    // Sandbox often indicates embedded applications/documents
    //
    if (iframe.hasAttribute("sandbox")) {
      score += 4;
    }

    //
    // Cross-origin access attempt (must never throw)
    //
    try {
      const doc = iframe.contentDocument;

      if (doc && doc.body) {
        const bodyText = doc.body.innerText || "";

        if (bodyText.length > 100) {
          score += 4;
        }
      }
    } catch (_) {
      // Cross-origin iframe.
      // Ignore; geometry-based scoring still works.
    }

    iframe.__primaryIframeScore = score;

    if (score > bestScore) {
      bestScore = score;
      best = iframe;
    }
  }

  if (!best) {
    return null;
  }

  const bestRect = best.getBoundingClientRect();
  const bestVisible = visibleRect(bestRect);

  if (
    best.__primaryIframeScore < 15 ||
    bestVisible.width * bestVisible.height < 5000
  ) {
    return null;
  }

  return best;
}
