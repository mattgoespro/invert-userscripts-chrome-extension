# Invert IDE Userscripts

An in-browser IDE for writing **TypeScript** and **SCSS** userscripts, compiling them, and injecting them into matching web pages.

---

## How this differs from classic userscript managers

Invert is not a Tampermonkey / Violentmonkey / Greasemonkey clone.

| Invert                                               | Classic managers                       |
| ---------------------------------------------------- | -------------------------------------- |
| Scripts run as ordinary page JS and CSS (MAIN world) | Often isolated worlds + `GM_*` APIs    |
| Match via Invert URL patterns                        | `@match` / `@include` metadata headers |
| No grants, `GM_xmlhttpRequest`, or similar           | Grant-based privileged APIs            |

If you need sandboxing or `GM_*` helpers, this extension is a different product.

---

## Day one

1. Open **Invert IDE** from the toolbar popup.
2. **Create a script**, add URL patterns for the sites you care about, and **enable** it.
3. Write TypeScript and/or SCSS, then **save** (`Ctrl/Cmd+S`).
4. Visit a matching page — the compiled JS and CSS inject automatically.

Optionally: share a script as a module for other scripts to import, or attach CDN libraries.

---

## Core features

### Write

Author scripts in Invert IDE (Monaco) with TypeScript, SCSS, and per-script type definitions.

- Language-aware editing: diagnostics, completions, hover, quick fixes
- Live compiled JS/CSS preview and an errors drawer (click to jump)
- Save persists, compiles, and re-injects into open tabs
- Local drafts until save, with a dirty indicator in the script list
- Command palette (`Ctrl/Cmd+K`) to jump pages, create scripts, and open scripts by name

### Match

Control where each script runs with glob URL patterns (`*` / `?`).

- Enable or disable from the IDE or the toolbar popup
- Badge shows how many scripts match the current tab
- URL Pattern Tester: check a URL, open tabs, or recent history

### Inject

Matching **enabled** scripts run automatically on navigation.

- Compiled JavaScript in the page’s main world
- Compiled CSS inserted into the page
- Optional CDN libraries and shared-script dependencies load first
- Saving (and import / minify rebuild) updates open tabs without restarting Chrome

### Compose

Reuse code across scripts:

- **Shared modules** — name a script so others can import `scripts/<name>/main` (and types); dependencies are detected from imports on save
- **CDN modules** — add libraries by URL, optionally link `@types` for IntelliSense, attach them per script

### Sync & move

- Scripts, modules, settings, and workspace layout sync via Chrome sync
- Export / import userscripts as JSON (import appends; validates and recompiles)
- Conflict dialog when remote changes meet unsaved drafts
- Storage quota breakdown in Settings

### Customize

Application and editor themes (with live preview), font size, tab size, format on save, and optional minify of compiled output.

---

## Appendix: behavior notes

Useful when composing shared modules or debugging “why didn’t this run?”

- **New scripts** start disabled, with no URL patterns — they never match until configured.
- **Empty pattern list** matches nothing.
- **Badge and popup** list matching scripts whether enabled or not; only enabled scripts inject.
- **Injection order** on a page: CDN libraries → shared dependencies → userscript JS → userscript CSS (CDN and shared deps are de-duplicated).
- **Shared dependencies** inject for a matching consumer even if the shared script is disabled or would not match the page. Only the shared script’s **JS** is pulled that way; its CSS applies only when that script itself matches and runs.
- **Enable / disable** alone applies on the next navigation (or the next save-driven re-inject).
- **Import** appends new IDs; missing CDN module refs are warned and stripped. Shared-module problems can block import.
- Scripts carry before/after page-load timing (`runAt`) in the runtime and in import/export; new scripts default to before load. There is no IDE control for this yet.
