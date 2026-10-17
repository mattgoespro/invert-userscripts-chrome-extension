# Incremental refactor delivery and validation

Initial implementation: 2026-10-14. Current branch: `main` in the primary checkout.

## Primary checkout handover (2026-10-17)

All tracked and untracked implementation changes were transferred from the linked worktree into the primary checkout on `main`, preserving its original uncommitted edits. Further development and test builds use this primary checkout. No commits or pushes were performed. Transfer backup and file hashes are under `.superpowers/transfer-from-worktree-20261017T175006/`. The earlier worktree remains an inactive recovery copy because Codex protects the checkout attached to this chat from archival. All further file operations target the primary `main` checkout.

Fresh verification in the primary checkout: **327/327 unit tests**, **8/8 focused browser tests**, root/tools typechecks, ESLint, production build and manifest/bundle gates passed. The primary `dist/options.js` contains both `Sort by` and `Name (default)`. The focused browser run loaded this primary build and covered sorting/persistence, minimum-width menu controls, import/export, restricted-page behavior, navigation races and startup.

## Follow-up: script list ordering and menu (2026-10-17)

The IDE header menu now offers **Sort by: Name (default) / Created**. Name uses the display name, case-insensitively with natural number ordering; Created is oldest first. The preference follows the existing persisted UI layout state. Sorting does not change saved script records or editor selection. The menu is portaled outside the sidebar, positioned within the viewport and repositioned on resizing. It uses a keyboard-operable native select, Escape/focus dismissal and compact Import/Export buttons. At narrow widths the header title truncates while both action buttons remain visible.

Verification: **327/327 unit tests**, **4/4 focused browser tests**, root/tools typechecks, ESLint, production build and manifest/bundle gates passed. Browser checks cover both ordering modes, reload persistence, minimum-width hit targets, unobscured/resized menu geometry, compact button heights, keyboard dismissal and existing import/export. The final narrow-layout preview is `.superpowers/script-list-menu-narrow.png`. The full browser suite was not repeated for this follow-up.

## Follow-up: restricted pages (2026-10-15)

Navigation previously pinned a document before checking page eligibility, producing a misleading document-changed error on Chrome's internal pages. A shared URL policy now skips browser/extension pages, non-page schemes and Chrome Web Store URLs in navigation, explicit apply, CSS cleanup, badge counts and popup matching. Ordinary HTTP/HTTPS pages and existing file URL support remain; Chrome still enforces host/file permissions.

Restricted tabs show a grey `–` badge and an explanatory tooltip. The popup remains available to open the IDE and explains that scripts cannot run on the current page. Normal tabs restore the amber matching count. No manifest permissions or icon assets were added.

Verification for this follow-up: **326/326 unit tests**, **9/9 focused Chromium tests** (restricted navigation, re-apply, popup, CSS and navigation races), root/tools typechecks, ESLint, production build and manifest/bundle gates passed. The real browser check navigated between `chrome://settings`, a normal website and `chrome://extensions`, verified badge restoration and observed no injection errors. Background: **54,447 / 55,296 bytes**; popup: **334,693 / 409,600 bytes**. The original full 63-test run below predates this follow-up; it was not repeated in full.

## Implementation and rollout status

The six deliveries are implemented in the existing four packages. Local document storage and verified sync are **opt-in migrations**. This work has not migrated an installed personal profile or released the extension. Signed-in Chrome Sync transport acceptance remains an external release gate.

| Delivery                | Implementation                                                                                                                                                                                          | Evidence                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A: boundaries           | Typed commands/build identities; worker AST module manifests; one workspace reconciliation boundary; three-buffer session capture/recovery                                                              | Publication, graph, draft, workspace, compiler suites; existing editor workflows                                                              |
| B: local publication    | Atomic IndexedDB aggregate; conditional revisions/alias checks; receipts; coordinated legacy writer drain/cutover; durable CSS obligation; unknown JS recovery                                          | Real IndexedDB, two IDE windows, paused legacy save, commit/reply retries, actual worker termination during JS/CSS                            |
| C: replication          | Immutable verified v3 chunks/manifests; causal heads; explicit conflicts/tombstones; quota-aware outbox/backoff; format-transition barrier; portable preferences; local layout                          | Codec/merge/coordinator tests; incomplete/corrupt/out-of-order delivery; separate-profile transport simulation                                |
| D: language acquisition | Stock Monaco worker; stable model IDs with separate public alias mapping; worker analysis for dirty imports; versioned bounded declaration cache; shared registration ownership; visible failures/retry | Ambient/import/auto-import browser tests; real undo after alias rename; offline cache, ranges, cancellation generation and bounds logic tests |
| E: execution            | Permission-gated `userScripts.execute` in MAIN; Chrome 135 floor; originating document pinning and current-intent checks; ordered async dependencies; separate CSS                                      | Enforced CSP, actual permission UI revocation, live apply/CSS, delayed CDN/disable/navigation, worker interruption                            |
| F: consolidation        | One background writer admission path even before migration; legacy codecs retained for upgrade/replication; no eval injector; recovery export is importer-compatible; updated ADRs/runbook              | Full validation results below; release gates explicitly retained                                                                              |

## Design rulings

- IndexedDB schema v1 stores one aggregate record. Sources, artifacts, conditional checks, aliases, receipts, causal metadata, outbox and CSS obligations share a short read/write transaction. Hashing/builds/network calls occur outside it. This is appropriate for the small userscript collection; very large collections may justify splitting stores later.
- A migration replaces an **inactive shadow generation**, verifies exact canonical source/metadata/module/settings sets against two complete legacy observations, and keeps only eligible artifacts. Legacy input is retained. It never writes migrated snapshots back to legacy sync. Active-marker retries return the existing authority rather than rerunning migration.
- All participating legacy mutations now enter the background queue. Activation waits for admitted writes (including compression) before observing the shadow. A call queued after cutover is rejected for refresh instead of writing through the retired authority. Additional IDE tabs must close before activation; updated popup writers use this same admission protocol.
- Ordinary edits descend from the local document branch; they never silently join remote conflict heads. Only generation-checked explicit resolution joins branches. Alias collisions from remote revisions remain recoverable conflicts, and resolution cannot bypass uniqueness.
- Verified-sync activation blocks new drains, finishes the existing v2 drain, durably enqueues the v3 snapshot, sets the format marker, then starts v3 delivery. A retry does not replace the pre-transition recovery snapshot.
- Retain source revisions, causal parent metadata, conflicts and tombstones. No global acknowledgements are assumed and no unsafe pruning runs. Quota exhaustion leaves local sources/outbox intact and reports pending replication; manual export/recovery is available. Long histories can exhaust Chrome's sync quota.
- CSS reconciliation obligations are persisted with commits, including artifact rebuilds. They resume on worker generation/alarm and clear only their own token. They execute no JavaScript. Started/unfinished JS is reported as unknown; only an explicit reapply starts it again. Execution is bounded at 30 seconds, after which completion remains uncertain.
- Review demonstrated the need for stable Monaco editing identity. Models now use `file:///userscripts/<immutable-id>/...`; compiler path aliases/package metadata preserve public `scripts/<module>/main|types` imports. Alias rename keeps the model/undo stack. No custom language worker was introduced.
- Declaration acquisition supports direct `types`/`typings`, root/direct subpath type exports, relative references and transitive package ranges. Unsupported `typesVersions`/wildcard export rules fail visibly. A range conflict is reported conservatively rather than silently choosing an incompatible version. Runtime CDN URLs are never rewritten.
- Automatic registrations remain deferred: `document_idle` does not reproduce the legacy completion trigger. The shipped adapter uses one-off execution with existing top-frame navigation triggers. No guaranteed document-start, all-frame or SPA execution is claimed.
- Chromium 148 returned a null result without an error field for both thrown code and rejected async wrappers. Execution now requires an explicit completion marker. The build worker identifies complete async IIFE expressions with its AST and the runtime awaits those promises; ordinary declarations/CDN globals retain classic scope. A failed shared dependency blocks its consumers while independent scripts continue.

## Bundle and startup measurements

Baseline production: background **19,195 bytes**, popup **327,814 bytes**; 280 unit tests and 43 browser tests passed. The clean-startup audit expects no redundant rebuilds, 16 Redux actions and two full sync reads.

After adding the transaction coordinator, immutable sync protocol, legacy writer admission, pending CSS recovery and schema transition, background measured **52,850 bytes** and popup **333,857 bytes**. The prior 50 KiB background budget failed explicitly. A narrow **54 KiB (55,296 byte)** budget replaces it for this additional runtime ownership; the popup stays at 400 KiB. The background still has no compiler/Monaco/Sass/Prettier dependency. This is a documented architecture cost, not a removed check. Final sizes are recorded with the final checks below.

## Verification results

Final source unit suite: **322/322 passed**. Root and tools TypeScript checks, ESLint and production Webpack build passed. Manifest/assets and bundle gates passed: background **53,815 bytes / 55,296**, popup **334,389 bytes / 409,600**. Webpack emits the existing large-editor asset warnings.

Final full browser suite: **63/63 passed in 4.0 minutes**, with no retries or skipped tests, on Chromium **148.0.7778.96** against the final production build. This includes minified nested-async initialization, failed-dependency isolation and top-frame scope. The runtime fixture uses the popup while seeding artifacts to prevent the IDE compiler from rebuilding them during navigation; recovery import explicitly navigates back to Scripts after restored Settings layout.

Independent fresh-context review found and reproduced coordination failures during development. Their regression tests and fixes were reviewed; the final narrow CSS review has no remaining findings (3/3 focused tests independently passed). Execution review caught classic async-declaration scope and async-generator classification edges; the worker AST flag and generator exclusion address both, with 6/6 focused execution tests passing. The final bundled worker was checked for that generator exclusion.

An optional `tsc -p e2e/tsconfig.json` audit still reports the pre-existing import-export `offsetHeight` SVG/HTML union errors and the ESM `.ts` import setting in build plugins. Root/tools typechecks are clean; Playwright transpiles and executes the browser tests. These unrelated files/configuration were not expanded into this refactor.

Focused evidence already observed:

- Migration retry, artifact receipt after settings/deletion, actual IndexedDB conditional writes/atomic alias abort.
- Actual IDE save through activated storage; dirty session retained against another window's publication; undo after alias rename.
- Real worker stopped after a committed source and during JavaScript; duplicate receipt and honest unknown/no replay.
- Real worker stopped while CSS removal was paused; a committed disable reconciled on restart with no renderer effect message.
- Paused admitted legacy write; activation waited and included its committed source.
- Delayed CDN source did not execute after disable or into a replacement document.
- Enforced page CSP blocked page inline JS while permission-enabled MAIN userscript execution worked; actual Chrome permission revocation blocked the API and displayed guidance.
- Two independent disposable profiles exchanged controlled revision payloads, preserved concurrent branches, and converged after explicit resolution. This is **transport simulation**, not signed-in Chrome Sync.
- Activated recovery export was imported through the legacy-compatible path and retained current source, SCSS and declaration data.

The ignored `.superpowers/sdd/2026-10-14-incremental-architecture-refactor/` ledger retains baseline/RED/GREEN/review logs, final artifact SHA-256 hashes and the original uncommitted patch. The primary checkout's tracked patch still matches the starting patch after normalizing line endings. No commits or pushes were performed.

## Release and acceptance gates still outside this implementation

- Real signed-in Chrome Sync on two controlled browser profiles, including offline transport, restart and eventual propagation.
- Chrome 135-specific enablement UX (automated browser evidence uses Chromium 148.0.7778.96); the version-specific UI copy is implemented, but older-cohort acceptance is separate.
- An actual older extension binary upgrade/downgrade rehearsal. The recovery data round trip is tested; swapping binaries in a signed-in cohort is not.
- Installed personal-profile acceptance and the complete restricted/file-page eligibility corpus. Existing URL-matcher tests remain, and execution fails without widening matching or bypassing permission.

## Activation and recovery procedure

1. Build `dist/`, load this version, and enable User Scripts using Chrome's extension details. Chrome 135-137 uses Developer mode; 138+ exposes Allow User Scripts.
2. Close other IDE tabs. In Settings, choose **Enable local document storage**. Dirty session recovery is local; saved source becomes authoritative in IndexedDB after verified cutover.
3. Download the recovery snapshot. Its top-level `userscripts` data is compatible with Import Userscripts; supplemental snapshot, legacy payloads and draft checkpoints remain available for diagnosis. Portable module definitions/settings are retained in the supplemental snapshot and should be restored separately if needed.
4. Update every synced browser before choosing **All my browsers are updated — enable verified sync**. Do not run old writers against this cohort afterward.
5. For recovery/downgrade, stop all writers, export the authoritative local data on each profile and explicitly resolve/export concurrent branches. Restore into a disposable profile first through Import Userscripts, then verify all three buffers, aliases, module definitions/settings and source counts. Do not flip `publicationBackend`/`verifiedSync` back to point at stale legacy records.
