# Implementation Plan

Executable roadmap for applying [`IDEAL-IMPLEMENTATION.md`](./IDEAL-IMPLEMENTATION.md) **inside this repository**. Product behavior remains as described in [`FEATURES.md`](./FEATURES.md).

**Strategy:** strangler evolution — no new repository, no long-lived parallel “v2” app. Ship vertical milestones with acceptance criteria and e2e coverage. Keep Chrome sync data compatible; migrate additively when shapes must change.

**Non-goals for this plan:** `GM_*` APIs, userscript metadata headers, isolated-world sandboxing, wholesale UI rebrand.

---

## How to use this document

1. Work **one milestone at a time** (M1 → M6). Do not start package splits (M4) before injection and editor performance (M1–M2) unless a tiny extract unblocks them.
2. Each milestone ends when **acceptance criteria** pass (automated preferred) and docs are updated if user-visible behavior changed.
3. Prefer **stacked PRs** within a milestone over one mega-PR.
4. Record cross-cutting choices under [Decisions](#decisions); do not re-litigate the vision mid-implementation.
5. Update the [Status](#status) table when a milestone starts or ships.

---

## Status

| Milestone | Focus                 | Status      |
| --------- | --------------------- | ----------- |
| M1        | Injection correctness | Not started |
| M2        | Editor performance    | Not started |
| M3        | State collapse        | Not started |
| M4        | Package boundaries    | Not started |
| M5        | UX streamlining       | Not started |
| M6        | Tooling               | Not started |

---

## Ground rules (strangler)

- **One write path per concern** as you touch an area (`saveScript`, `applyScript`, hydrate). Leave old call sites as thin wrappers until deleted in the same or next PR.
- **No second options page** or duplicate IDE shell.
- **Extract before rewrite** when logic is duplicated (normalize/merge/hydrate).
- **Storage:** additive migrations only; do not wipe sync to “clean up.”
- **Tests first** for behavior you are about to change — especially injection and drafts.
- **Webpack stays** until M6 unless a milestone is blocked (see Decisions).

---

## M1 — Injection correctness

Highest user-trust leverage. Fixes “toggle did nothing,” style stacking, and blunt all-tab refresh.

### Goals

- Apply or tear down scripts on **matching open tabs only**.
- **CSS replace** semantics on re-apply (no accumulation).
- **Enable/disable** immediately applies or removes on matching tabs (not only on next navigation/save).
- Typed runtime messages that express intent (`apply` / `setEnabled`) rather than only a global `refreshTabs`.

### Out of scope

- Monaco / draft model changes
- Package extractions beyond what’s needed to share match helpers
- UI redesign

### Likely touch paths

| Area         | Paths                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Messages     | `packages/shared/src/messages.ts`                                                                                      |
| SW apply     | `packages/runtime/src/handlers/extension-handlers/runtime.handler.ts`                                                  |
| Inject       | `packages/runtime/src/ide/scripts.ts`                                                                                  |
| Callers      | `packages/renderer/src/shared/store/slices/userscripts/thunks.userscripts.ts`, `.../code-editor/thunks.code-editor.ts` |
| Popup toggle | `packages/renderer/src/popup/`, `ScriptListItem.tsx`                                                                   |

### Suggested approach

1. Extend the message API, e.g. `scripts.apply { scriptId? }`, `scripts.setEnabled { scriptId, enabled }`. Keep `refreshTabs` as a deprecated wrapper that filters by match until callers migrate.
2. Track CSS insertion so re-apply can `removeCSS` (or equivalent) before insert. Define how MAIN-world **JS** re-exec is handled (document: may require tab reload for full teardown of JS side effects; CSS and “don’t run on next load” must still be correct for disable).
3. Wire `toggleUserscript` (IDE + popup) to `setEnabled` + apply/remove.
4. Change save/import/rebuild refresh to apply only tabs matching the affected script(s) (include consumers when a shared module’s JS changes, if applicable).

### Acceptance criteria

- [ ] Toggling a script **on** injects into an already-open matching tab without navigation.
- [ ] Toggling a script **off** stops CSS on that tab (and does not run on next navigation); document any JS teardown limits in `FEATURES.md` appendix if full JS undo is impossible without reload.
- [ ] Saving the same CSS twice does **not** visually stack (e.g. opacity/margin doubling).
- [ ] Apply/refresh does not touch unrelated tabs (spot-check or e2e with two tabs).
- [ ] Existing e2e still green; add coverage under `e2e/tests/` for toggle-apply and CSS replace if feasible in Playwright.

### Rollback

Feature-flag or keep `refreshTabs` path behind a sync setting for one release if needed; default to new apply semantics once e2e passes.

---

## M2 — Editor performance

Make typing cheap. Preview and typechecking must not own the keystroke path.

### Goals

- Debounced and **cancelable** live JS preview (or preview only when Output drawer is open / on idle).
- **Lazy Monaco workspace**: models for the active script + resolved shared-dependency closure, not every script at IDE boot.
- Reduce shared-module “red flash” by ensuring dependency models exist before the consumer is typechecked.

### Out of scope

- Full draft/Redux collapse (M3)
- Vite migration (M6)

### Likely touch paths

| Area         | Paths                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Live compile | `packages/renderer/src/options/invert-ide/pages/scripts-page/script-editor/ScriptEditor.tsx` |
| Compiler     | `packages/renderer/src/sandbox/compiler.ts`                                                  |
| Workspace    | `packages/monaco/` (VFS / workspace service under renderer that owns models)                 |
| Boot         | `packages/renderer/src/options/invert-ide/InvertIde.tsx` (and workspace start hooks)         |

### Suggested approach

1. Debounce TS preview (~300–500ms); cancel in-flight worker jobs on newer revisions; keep SCSS debounce.
2. Gate preview on drawer visibility if still too hot after debounce.
3. Change workspace bootstrap to open active + import graph only; open additional models when selection changes.
4. Revisit stale-rebuild-on-boot so it doesn’t serialize-compile the world on every IDE open unless artifacts are actually stale.

### Acceptance criteria

- [ ] Typing in a medium script does not queue a transpile per keystroke (verify via logging or performance marks in dev).
- [ ] Opening the IDE with many scripts does not create Monaco models for all of them up front.
- [ ] Switching scripts still gets full IntelliSense for that script’s shared imports.
- [ ] Shared import path does not systematically flash as missing then resolve (manual or e2e smoke).
- [ ] Save path still compiles and triggers M1 apply semantics.

### Rollback

Re-enable eager models via flag if a shared-import edge case regresses; keep debounce regardless.

---

## M3 — State collapse

One coherence model for “what I’m editing.”

### Goals

- **Open document** = Monaco models + single dirty bit (or revision vs `lastSaved`).
- Remove mirrored `userscripts.status` / unused error fields once UI reads dirty from the open-doc layer.
- **Conflict “keep local”** persists local buffers to sync (or copy explicitly states that save is required — prefer persist).
- Unify layout/nav into the same store as domain UI state (eliminate split brain between `GlobalStateContext` and Redux for sidebar/panels).

### Out of scope

- Extracting `packages/compile` (M4)
- Visual IDE redesign (M5)

### Likely touch paths

| Area          | Paths                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Drafts        | `packages/renderer/src/shared/store/slices/editor-drafts/`                    |
| Userscripts   | `packages/renderer/src/shared/store/slices/userscripts/`                      |
| Listeners     | store middleware mirroring dirty → `status`                                   |
| Conflicts     | `packages/renderer/src/options/invert-ide/components/conflict-dialog/`        |
| Layout        | `GlobalStateProvider` / `GlobalStateManager` vs `workspace` / settings slices |
| List dirty UI | `ScriptListItem`, scripts page                                                |

### Suggested approach

1. Define `OpenDocument` (or slim the drafts slice to one active id + buffers + conflicts queue).
2. Make `saveScript` the only path that reads models → compile → storage → apply.
3. Fix conflict resolve to write sync when keeping local.
4. Move sidebar tab + panel sizes into persisted UI slice; update command palette to dispatch that store only.
5. Delete `status: modified \| saved` after list UI is switched.

### Acceptance criteria

- [ ] Dirty indicator matches Monaco vs last saved; no separate status field required.
- [ ] “Keep local” on conflict results in remote storage matching local (after resolve), without a mysterious extra Save — or UX copy + one-click save is explicit and tested.
- [ ] Remote clean updates still apply when the doc is not dirty.
- [ ] Command palette navigation and layout persistence still work after dropping duplicate global context.
- [ ] `e2e/tests/scripts/draft-sync.spec.ts` updated and green; extend for keep-local persist.

### Rollback

Keep drafts slice shape but stop writing `status`; dual-read dirty for one release if needed.

---

## M4 — Package boundaries

Make architecture match the vision without a greenfield repo.

### Goals

- Single **hydrate / normalize / merge compiled** API used by runtime and IDE.
- Extract **compile** behind a clear module boundary (worker entry can stay; API lives in one place).
- Thin userscripts thunks into use-case functions that call storage + compile + inject messages.
- Popup can read matches without bootstrapping the full IDE data path (narrow storage read).

### Out of scope

- Vite (M6)
- Large UX changes (M5)

### Likely touch paths

| Area               | Paths                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Duplicated hydrate | runtime helpers, `thunks.userscripts.ts`, `editor-drafts` storage-sync                                 |
| Sync storage       | `packages/shared/src/storage/sync.storage.ts`                                                          |
| Compiler           | `packages/renderer/src/sandbox/compiler.ts` → e.g. `packages/compile` or `packages/shared/src/compile` |
| Popup              | `packages/renderer/src/popup/Popup.tsx`                                                                |
| Webpack entries    | `webpack.config.ts`                                                                                    |

### Suggested approach

1. Extract hydrate to `packages/shared` (or new `packages/domain`) and switch all callers.
2. Move compile API to a package both IDE and tests import; keep Sass sandbox as an implementation detail.
3. Split `thunks.userscripts.ts` by use case files.
4. Popup: `storage.local/sync` read + match filter; message SW for toggle.

### Acceptance criteria

- [ ] No triplicate `normalizeUserscript` / `mergeCompiledCode` implementations.
- [ ] Compiler imported from one package path.
- [ ] Popup bundle no longer needs the full options store bootstrap for the happy path (measure or assert entry imports).
- [ ] Unit tests cover hydrate + import graph helpers.
- [ ] All e2e green.

### Rollback

Re-export old paths as shims so call sites can migrate PR-by-PR.

---

## M5 — UX streamlining

Editor-first UI; honest affordances; finish incomplete surfaces.

### Goals

- Problems-first drawer; Output secondary / collapsed by default.
- Dependencies (shared + CDN) in a drawer or `⋯` menu — not competing with the code panes by default.
- Command palette: only real shortcuts; static commands + dynamic script search.
- **`runAt`:** ship IDE control **or** remove from marketing/export docs until shipped (prefer ship a simple select).
- Pattern tester: open tabs + manual URL; drop or fix history if permission missing.
- Toast: “Applied to N matching tabs” after save/toggle.
- Empty state / onboarding for new scripts (patterns + enable).
- Conflict and shared-CSS policy copy aligned with real behavior (update `FEATURES.md`).

### Out of scope

- New theme system
- Bundler migration

### Likely touch paths

| Area                 | Paths                                                   |
| -------------------- | ------------------------------------------------------- |
| Script editor chrome | `ScriptEditor.tsx`, `ScriptMetadata`, drawer components |
| Palette              | `command-palette/`, `useRegisterCoreCommands.ts`        |
| URL tester           | `url-pattern-tester/`                                   |
| Features doc         | `docs/FEATURES.md`                                      |
| Root `FEATURES.md`   | Deduplicate or point to `docs/FEATURES.md`              |

### Acceptance criteria

- [ ] Default Scripts layout emphasizes code + problems; deps are one click away.
- [ ] Palette shows no unbound shortcut chips.
- [ ] `runAt` is either editable in IDE and covered by a test, or absent from user-facing feature docs.
- [ ] History tester either works with declared permission or is removed.
- [ ] Apply toasts land for save and toggle.
- [ ] `docs/FEATURES.md` appendix matches shipped behavior; root `FEATURES.md` not diverging.

### Rollback

Layout flags for “legacy three-pane metadata” if needed; keep for one release.

---

## M6 — Tooling

Do last so product fixes are not blocked on build rewrites.

### Goals

- Single manifest source of truth (generated or one plugin-owned pipeline).
- Bundle size pass for options / popup / background.
- Optional: evaluate Vite + CRX **only if** Webpack is clearly blocking DX; not mandatory to complete the vision.
- e2e remains the contract for match / inject / import / drafts.

### Acceptance criteria

- [ ] Manifest version/paths cannot drift from build output unnoticed (CI or plugin check).
- [ ] Popup and background bundles measurably leaner or documented as already minimal.
- [ ] CI e2e green on main.

---

## Cross-milestone test strategy

| Layer                           | Role                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unit (`tests/`, domain helpers) | URL match, import graph, hydrate, transfer schema                                                 |
| Playwright (`e2e/`)             | create/save, drafts/conflicts, import/export, popup toggle, settings; **extend for M1 apply/CSS** |
| Manual checklist                | Multi-tab apply isolation, CSS stacking, large-script typing feel                                 |

Before changing injection or drafts, add or adjust a failing test that encodes the target behavior, then implement.

---

## Decisions

Record choices here as they are made. Default until then:

| Topic                  | Default                                   | Notes                                                               |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Repository             | **Evolve in place**                       | No greenfield rewrite                                               |
| Bundler                | **Keep Webpack through M5**               | Revisit in M6                                                       |
| State library          | **Keep Redux Toolkit through M3**         | Collapse model first; replace library only if it still hurts        |
| Shared-dep CSS         | **Keep JS-only inject; document clearly** | Optional “include styles” later                                     |
| JS teardown on disable | **Best-effort**                           | CSS off + no future inject; full JS undo may need reload — document |
| `runAt`                | **Decide in M5**                          | Prefer simple IDE control over silent export-only field             |

### Decision log

| Date       | Decision          | Rationale                                                         |
| ---------- | ----------------- | ----------------------------------------------------------------- |
| 2026-07-12 | No new repository | Vision is seams/semantics; storage/inject/Monaco investment stays |

---

## Mapping to the vision doc

| Ideal §5 priority     | Milestone |
| --------------------- | --------- |
| Injection correctness | M1        |
| Editor performance    | M2        |
| State collapse        | M3        |
| Package boundaries    | M4        |
| UX streamlining       | M5        |
| Tooling               | M6        |

When behavior ships, update [`FEATURES.md`](./FEATURES.md) (and remove or redirect root `FEATURES.md` in M5). Leave [`IDEAL-IMPLEMENTATION.md`](./IDEAL-IMPLEMENTATION.md) as the stable “why”; change **this** file for “what’s next.”

---

## First concrete slice (start here)

**M1a — Message + matching-tab apply for save**
Replace all-tab `refreshTabs` usage from save/rebuild with apply-by-scriptId to matching tabs only. No UI changes.

**M1b — CSS replace**
Track and remove previous CSS before insert on apply.

**M1c — Toggle applies immediately**
Popup + IDE toggles call `setEnabled` + apply/remove.

Then proceed to M2.
