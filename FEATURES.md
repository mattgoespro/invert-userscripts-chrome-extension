# Invert IDE Userscripts

An in-browser IDE for writing TypeScript and SCSS userscripts — then compiling and injecting them into matching pages.

Scripts run as ordinary page JavaScript and CSS. There is no Greasemonkey / Tampermonkey `GM_*` API layer.

---

## Write

Author userscripts in **Invert IDE**, a Monaco-based editor with a three-pane layout:

- **TypeScript** for script logic (`// script.ts`)
- **SCSS** for styles (`// styles.scss`)
- **Type definitions** stacked under the script (`// types.d.ts`)

Language-aware editing includes diagnostics, completions, hover info, and a collapsible **compiled JS / CSS / errors** drawer that updates as you type. Click an error to jump to the right editor and line. Monaco quick fixes include wrap-in-try/catch and generate JSDoc.

Save with `Ctrl/Cmd+S` to persist, compile, and re-inject into open tabs. Unsaved buffers stay as **local drafts** until you save — the script list shows a dirty indicator while they differ from synced storage.

A **command palette** (`Ctrl/Cmd+K`) fuzzy-searches pages, create-script, and jump-to-script by name. Recent commands sync across sessions; shortcut hints in the palette are labels — only `Ctrl/Cmd+K` and `Ctrl/Cmd+S` are hard-bound.

New scripts start **disabled**, with placeholder sources and **no URL patterns**, so they never run until you configure them.

---

## Match

Each script has **URL patterns** (glob `*` / `?` against the full URL) that decide where it can run. Patterns are edited as chips with live validation, multi-add, and clear-all. An empty pattern list matches nothing.

The **URL Pattern Tester** checks a typed URL, all open tabs, or recent history, and shows which pattern matched.

Enable or disable scripts from the toolbar popup or the IDE. The popup lists every script that matches the current tab (enabled or not). The extension badge count likewise includes matching scripts whether or not they are enabled.

---

## Inject

Matching **enabled** scripts are injected automatically on navigation. On a page, order is:

1. **CDN libraries** (await load; de-duplicated)
2. **Shared script dependencies** (de-duplicated)
3. **Userscript JavaScript** (page main world)
4. **Userscript CSS**

Shared dependencies inject when a consumer script needs them — even if the shared script is disabled or would not match the page URL on its own. Only the shared script’s **JS** is pulled in that way; its CSS applies only when that script itself matches and runs.

Changes from save, import, or a minify rebuild re-inject open tabs. Enable/disable alone takes effect on the next navigation (or the next save-driven re-inject).

Scripts also carry a before/after page-load timing (`runAt`) used by the runtime and preserved in import/export; new scripts default to before load.

---

## Compose

Build reusable pieces instead of one-off scripts:

| Capability         | What it does                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared modules** | Give a script a module name (auto-fill from the display name) so others can `import` from `scripts/<name>/main` or `…/types`. Dependencies are **detected from imports on save**, not picked manually. Completions and shared type panes feed IntelliSense. |
| **CDN modules**    | Add named libraries by URL (HEAD-checked). Optionally link an npm package for `@types` IntelliSense. Attach enabled modules per script; globally disabled modules are hidden from attach UI and skipped at inject time.                                     |

---

## Sync & move

Scripts, modules, settings, and **workspace layout** (selected script, sidebar page, panel sizes, output drawer) sync across signed-in Chrome profiles.

If remote storage changes while you have unsaved drafts, a **conflict dialog** shows local vs remote previews with keep-local / take-remote (including bulk actions).

**Export** downloads a dated JSON file of all userscripts. **Import** validates and **appends** (new IDs), warns when referenced CDN modules are missing, and recompiles for injection afterward.

Settings include a **storage quota** panel with live sync vs local usage and a breakdown of what is consuming space.

---

## Customize

Choose among eight application themes and a dozen editor themes (with a live Monaco preview), adjust font size (8–32) and tab size (2–8), and optionally format on save or minify compiled output. Toggling minify rebuilds every script’s compiled artifacts.
