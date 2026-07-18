# Ideal Implementation Vision

A redesign sketch for **Invert IDE Userscripts**, given the same product goals as [`FEATURES.md`](./FEATURES.md): an in-browser TypeScript + SCSS IDE that compiles and injects userscripts into matching pages (MAIN world, no `GM_*`).

This is not a migration plan. It is how I would structure the product for robustness and a streamlined editor experience, and how that approach addresses issues visible in the current repository.

**To execute this vision in-repo, follow [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)** (milestones M1–M6, acceptance criteria, strangler rules).

---

## 1. Architecture

### Guiding principles

1. **One source of truth per concern** — Monaco owns open buffers; a small domain store owns saved scripts; the service worker owns injection. Nothing else caches “the current code.”
2. **Compile on save (and on demand)** — live preview is optional and throttled, never on the critical path of typing.
3. **Matching-tab apply** — never re-inject every open tab by default.
4. **Packages follow Chrome surfaces** — boundaries match MV3 entry points, not accidental history.

### Proposed package layout

```text
packages/
  domain/                 # Pure TS: models, URL match, import graph, validate, transfer schemas
  storage/                # chrome.storage adapters: sync (sources) + local (artifacts)
  compile/                # TS + SCSS pipelines (workers / sandbox only)
  inject/                 # Service worker: match → order → inject → badge
  ide/                    # Options page React app (Invert IDE)
  popup/                  # Lightweight popup (minimal deps)
  editor/                 # Monaco workspace: models, themes, TS config, completions
apps/                     # (optional) thin webpack/vite entry wrappers
e2e/
docs/
```

| Package   | Responsibility                                                                               | Must not                    |
| --------- | -------------------------------------------------------------------------------------------- | --------------------------- |
| `domain`  | `Userscript`, patterns, shared-import resolution, Zod (or similar) schemas for import/export | Touch Chrome APIs or React  |
| `storage` | Read/write sync + local, chunking, quota reporting, change events                            | Know about Monaco or Redux  |
| `compile` | `ts → js`, `scss → css`, minify flag, shared-module rewrite                                  | Persist or inject           |
| `inject`  | Tab/nav listeners, CDN → deps → JS → CSS, refresh **matching** tabs, CSS replace             | Own editor UI               |
| `ide`     | Pages, layout, commands, dialogs                                                             | Reimplement compile/storage |
| `popup`   | Match list + toggles + open IDE                                                              | Pull the full IDE bundle    |
| `editor`  | Monaco/Shiki, VFS, attach/detach models for **active** script (+ shared deps)                | Own Redux slices            |

Today’s `packages/shared` + `packages/runtime` + `packages/renderer` + `packages/monaco` already lean this way; the redesign makes the seams stricter and shrinks `renderer` from “everything UI + half of persistence.”

### MV3 runtime shape

```text
                    ┌─────────────┐
  chrome.tabs /     │  inject SW  │◄── messages: applyScript(id), setEnabled, getMatches
  webNavigation ───►│             │──► chrome.scripting + insertCSS/removeCSS
                    └──────┬──────┘
                           │ reads
                    ┌──────▼──────┐
                    │   storage   │  sync: sources + settings
                    │             │  local: compiled artifacts + inject bookmarks
                    └──────▲──────┘
                           │ writes on save
          ┌────────────────┴────────────────┐
          │  ide (options)                  │  popup
          │  editor ↔ draft buffer          │  list + toggle only
          │  compile worker on save/preview │
          └─────────────────────────────────┘
```

**Message API (small, typed):**

- `scripts.apply` `{ scriptId }` — recompile if needed, inject into matching open tabs
- `scripts.setEnabled` `{ scriptId, enabled }` — persist + apply/remove on matching tabs
- `tabs.getMatches` — popup/badge
- `storage.changed` — fan-out already exists; IDE listens and merges without full reloads when possible

### State & code patterns

**Saved scripts (durable)**
Normalized entity store: `scripts`, `modules`, `settings`, `ui` (layout). Prefer a thin store (Redux Toolkit **or** Zustand + Immer) with **one** write path: `saveScript(id)`.

**Open editor (ephemeral)**
For the active script only:

```text
Monaco models  →  (on change) dirty flag + debounced preview job
Save           →  read models → compile → storage → message inject.apply
Remote change  →  if clean: reload models; if dirty: conflict UI
```

Drop the current triple cache (`Monaco` ↔ `editorDrafts` ↔ `userscripts` + mirrored `currentUserscript` + `status: modified|saved`). Dirty means “model ≠ last saved revision,” computed or stored once next to the open document—not mirrored into three places.

**Layout**
Keep panel sizes / sidebar tab / drawer in `ui` persistence (sync or local). Do not split “global React context” vs Redux for the same navigation concerns; commands should dispatch one store.

**Conventions**

- Feature folders in `ide/`: `scripts/`, `modules/`, `settings/`, `shell/` — each owns page + local components
- Shared UI primitives only under `ide/ui/` (Dialog, Toast, Panel, ChipInput)
- Domain validation with a schema library once (import, storage hydrate, create defaults)
- No duplicated `normalizeUserscript` / `mergeCompiledCode` across packages — one `domain` + `storage` hydrate API
- Workers for compile; main thread for UI; SW for inject only

### Tools (pragmatic stack)

| Concern      | Choice                                                                                       | Why                                               |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Bundling     | Vite + `@crxjs/vite-plugin` (or keep Webpack if preferred, but one manifest source of truth) | Less dual-manifest drift; faster IDE HMR          |
| UI           | React 19 + CSS modules or existing token CSS                                                 | Match current look; avoid new design-system churn |
| Editor       | Monaco + Shiki (kept)                                                                        | Core product value                                |
| Schemas      | Zod                                                                                          | Import/export + storage migration in one place    |
| Compile TS   | Existing esbuild/sucrase-style path in a worker                                              | Cancelable jobs, no UI jank                       |
| Compile SCSS | Keep sandbox iframe **or** move to a dedicated worker if CSP allows                          | Isolate `unsafe-eval`                             |
| Tests        | Playwright e2e (keep) + domain unit tests for match/import graph                             | Lock injection semantics                          |

---

## 2. Features to remove, change, or refine

Goal: a **faster, clearer editor** with fewer surprising behaviors—not a smaller feature checklist for its own sake.

### Remove or defer

| Item                                                           | Rationale                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Live JS transpile on every keystroke**                       | Dominates CPU; preview should be debounced (~300–500ms) or “preview on idle / button / drawer open”          |
| **Eager Monaco models for every script**                       | Load active script + resolved shared deps only; fixes type-flash and large-workspace cost                    |
| **Palette shortcut labels that aren’t bound**                  | Either bind `1/2/3/N` or don’t show them — fake affordances erode trust                                      |
| **History-based pattern testing without `history` permission** | Open tabs + manual URL are enough; don’t advertise a broken path                                             |
| **Half-exposed `runAt`**                                       | Either ship a clear “Run at: document start / document idle” control, or drop from export surface until then |
| **Userscript `status` / unused `error` fields**                | Replace with derived dirty + compile diagnostics                                                             |

### Change (same feature, better semantics)

| Feature                   | Change                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Enable / disable**      | Immediately apply or tear down on **matching open tabs** (with safe CSS removal). No “wait until next navigation or save.”                |
| **Re-inject on save**     | Apply only to tabs whose URL matches that script (and dependents), not `tabs.query({})`                                                   |
| **CSS on refresh**        | Track insertion IDs / use `removeCSS` before re-insert — stop stacking styles                                                             |
| **Shared dependency CSS** | Document and optionally offer “include shared styles” — today’s JS-only dep inject is a footgun                                           |
| **New script defaults**   | Start with a suggested pattern template or onboarding empty state (“Add a pattern to run”), still disabled until explicit enable          |
| **Import**                | Single validate → resolve modules → compile → write pipeline; CDN warnings stay; shared-module hard fail stays                            |
| **Conflict “keep local”** | Must **write** local draft to sync (or clearly say “keep editing, remote ignored until save”) — today’s clear-only behavior is incomplete |
| **Command palette**       | Static commands + dynamic “Open script…” search over names; don’t register N permanent commands that churn when the map changes           |
| **Minify toggle**         | Background rebuild queue with progress toast; never block the IDE shell                                                                   |

### Refine (keep, but streamline UX)

- **URL patterns** — keep chips + tester; make tester a first-class panel (“Does this script run here?”) next to patterns, not a buried globe control
- **Shared modules** — keep import detection; show a small dependency graph in options (“used by / uses”) so compose isn’t invisible
- **CDN modules** — keep HEAD + `@types` checks; allow “skip validation” for offline installs
- **Drafts + sync** — keep; simplify to open-doc dirty + conflict queue only
- **Storage quota panel** — keep for power users; collapse under Settings → Advanced
- **Themes / font / tab / format on save** — keep; theme preview can be a static sample, not a second live Monaco if cost matters

### Explicit non-goals (still)

No `GM_*`, no userscript header parser, no isolated-world sandbox. The product stays “page-native TS/SCSS IDE.” Adding a compatibility layer would fight the architecture above.

---

## 3. UI and UX layout

### Product chrome

**Popup (fast, dumb)**
Matching scripts for this tab: name, enable switch, dirty/error dot, “Edit” opens IDE focused on that script. Footer: Open Invert IDE. No Redux bootstrap of the full options store if a narrow `storage` read suffices.

**IDE shell**

```text
┌──────────┬──────────────────────────────────────────────────────────────┐
│ Scripts  │  Script title          [Enabled]  [Save]  [⋯]                 │
│ Modules  │  Patterns: [chips…]                    [Test on this tab]     │
│ Settings │──────────────────────────────────────────────────────────────│
│          │  script.ts          │  styles.scss                            │
│  list    │                     │                                         │
│  • A ●   │                     │                                         │
│  • B ▣   │  types.d.ts         │                                         │
│          │──────────────────────────────────────────────────────────────│
│          │  Problems │ Output                                      ▭ ▭  │
└──────────┴──────────────────────────────────────────────────────────────┘
```

- **Primary column**: code. Metadata is a compact header, not a second major region competing with editors.
- **Problems** before **Output** — diagnostics drive the edit loop; compiled JS/CSS is secondary (collapsed by default unless opened).
- **One visible “Save”** with dirty state; autosave optional later, not required for v1 redesign.
- **Shared / CDN** live under `⋯` or a side drawer “Dependencies,” so the default path is write → pattern → enable → save.

### Interaction design

1. **Day-one empty state** on Scripts: one CTA (“New script”), three bullets (pattern, enable, save), link to a sample.
2. **Focus mode**: optional hide list + collapse deps while typing (`Ctrl/Cmd+K` → “Toggle focus”).
3. **Apply feedback**: toast “Applied to N matching tabs” after save/toggle — makes injection tangible.
4. **Command palette**: navigation, create, open script, save, toggle focus, open dependencies — no fake keybindings.
5. **Conflicts**: side-by-side only for the buffers that actually differ; default action “Keep editing (save to overwrite remote)” vs “Load remote.”

### Visual design

Stay within the existing Graphite / Obsidian language: dense IDE, not marketing UI. Refine rather than rebrand:

- Clear hierarchy: script name > patterns > editors > drawer
- Dirty = subtle accent dot; shared = package icon (already good)
- Avoid stacking another resizable region by default; prefer a fixed problems strip + optional output

---

## 4. How this addresses repository issues

### Code & component neatness

| Current pressure                                                | Redesign move                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ScriptEditor.tsx` as nested panel + live compile orchestration | Shell layout component + `ActiveDocument` controller; editors are presentational                                           |
| `thunks.userscripts.ts` god-file                                | Use-cases: `createScript`, `saveScript`, `toggleScript`, `importBundle` — each calls `storage` / `compile` / `inject` APIs |
| Duplicated normalize/merge in runtime, drafts, thunks           | Single `domain` + `storage.hydrate`                                                                                        |
| `GlobalStateContext` vs Redux for layout/nav                    | One UI slice                                                                                                               |
| Transfer validators hand-rolled beside save path                | Shared Zod schemas                                                                                                         |

### Maintainability

- **Draft / saved / Monaco coherence** becomes “open document” vs “entity store” — the main class of sync bugs shrinks.
- **Injection policy** lives only in `inject` (order, dedupe, shared-dep rules, CSS lifecycle) with unit tests — IDE cannot accidentally call `tabs.query({})`.
- **Compile** is a pure package with cancel tokens — UI and SW both call it without copying transforms.
- Docs (`FEATURES`, behavior appendix) stay aligned because incomplete surfaces (`runAt`, fake shortcuts) are either finished or removed.

### Runtime performance

| Issue today                               | Redesign                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| TS recompile every keystroke              | Debounced / on-demand preview; save path only on save |
| `refreshTabs` all tabs × both timings     | Match filter + per-script apply                       |
| CSS accumulation via repeated `insertCSS` | `removeCSS` / tracked IDs                             |
| Eager models for all scripts              | Active + dependency closure                           |
| Full storage refresh on visibility        | Key-diff merge from `storage.onChanged`               |
| Minify rebuild blocks perception          | Queued background jobs                                |
| Popup loads full IDE data path            | Narrow read for matches                               |

### Common product problems

| User-visible problem                   | Fix                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| “I toggled enable but nothing changed” | Toggle → apply/remove on matching tabs                                                          |
| “Styles got stronger every save”       | CSS replace semantics                                                                           |
| “Shared import is red then clears”     | Don’t typecheck the whole vault at once; ensure deps’ models exist before checking the consumer |
| “Keep local” didn’t stick              | Persist local on conflict resolve                                                               |
| “Why didn’t my shared CSS apply?”      | Explicit dependency policy in UI + docs                                                         |
| Confusion with Tampermonkey            | Keep the differ box; don’t grow GM-like APIs                                                    |

---

## 5. Suggested priority if this were a roadmap

Formalized as milestones with acceptance criteria in [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md):

1. **M1 Injection correctness** — matching-tab apply, CSS replace, toggle applies immediately
2. **M2 Editor performance** — debounce/cancel preview; lazy Monaco workspace
3. **M3 State collapse** — single open-document dirty model; delete mirrored `status`
4. **M4 Package boundaries** — extract `compile` + unify hydrate; thin thunks
5. **M5 UX streamlining** — problems-first drawer, dependencies drawer, honest palette, finish or hide `runAt`
6. **M6 Tooling** — single manifest pipeline; keep e2e as the contract for match/inject/import

---

## 6. Summary

I would keep Invert’s identity — **Monaco IDE → compile TS/SCSS → MAIN-world inject by URL pattern** — but treat the editor as a **document app** and the service worker as a **precise applicator**, with compile and storage as pure libraries between them.

The biggest wins are not new features: **fewer sources of truth**, **cheaper typing**, **honest apply semantics**, and a **UI that puts code and problems first** while tucking compose/sync power under clear secondary surfaces. That combination directly targets the neatness, maintainability, performance, and “why did it do that?” issues already latent in this repository.
