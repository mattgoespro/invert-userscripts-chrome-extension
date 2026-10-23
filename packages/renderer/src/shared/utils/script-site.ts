import type { Userscript } from "@shared/model";

export const EVERY_SITE_GROUP = "Every site";
export const NO_PATTERNS_GROUP = "No URL patterns";

function hostOf(pattern: string): string | null {
  const match = /^[^:/]+:\/\/([^/]+)/.exec(pattern.trim());
  if (!match) {
    return null;
  }
  return match[1].replace(/:[0-9*?]+$/, "").toLowerCase();
}

/** The site a script is filed under: the host of its first URL pattern. */
export function getScriptSiteGroup(script: Userscript): string {
  const patterns = script.urlPatterns ?? [];
  if (patterns.length === 0) {
    return NO_PATTERNS_GROUP;
  }

  const host = hostOf(patterns[0]);
  if (!host || host === "*") {
    return EVERY_SITE_GROUP;
  }

  return host.replace(/^\*\./, "").replace(/^www\./, "");
}

/** A short, scheme-free summary of a script's URL patterns for list rows. */
export function summarizeUrlPatterns(patterns: string[] | undefined): string {
  if (!patterns || patterns.length === 0) {
    return "No URL patterns";
  }

  const first = patterns[0].replace(/^(\*|https?):\/\//, "");
  return patterns.length > 1 ? `${first} +${patterns.length - 1}` : first;
}

export interface ScriptSiteGroup {
  site: string;
  scripts: Userscript[];
}

/** Groups already-sorted scripts by site, keeping catch-all groups last. */
export function groupScriptsBySite(scripts: Userscript[]): ScriptSiteGroup[] {
  const groups = new Map<string, Userscript[]>();
  for (const script of scripts) {
    const site = getScriptSiteGroup(script);
    groups.set(site, [...(groups.get(site) ?? []), script]);
  }

  const rank = (site: string): number =>
    site === EVERY_SITE_GROUP ? 1 : site === NO_PATTERNS_GROUP ? 2 : 0;

  return [...groups.entries()]
    .sort(
      ([a], [b]) =>
        rank(a) - rank(b) ||
        a.localeCompare(b, undefined, { sensitivity: "base" })
    )
    .map(([site, groupScripts]) => ({ site, scripts: groupScripts }));
}
