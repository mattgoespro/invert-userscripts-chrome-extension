# Incremental Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this installation the corresponding skills are named `subagent-driven-development` and `executing-plans`. Use native sequential execution unless the user chooses delegation; this document does not authorize spawning agents or committing changes.

**Goal:** Integrate the six proposed ADRs incrementally while retaining the existing extension, four-package layout, features, and recoverable user data.

**Architecture:** Introduce contracts around existing services, then add a transactional backend in shadow mode before moving local publication ownership to the background. Migrate sync and execution independently after the boundary refactor works. Keep Redux, Monaco's existing worker, the JS build worker, the Sass sandbox, and the current shared-module runtime.

**Tech Stack:** TypeScript 5.9, React 19, Redux Toolkit, Monaco 0.55, Chrome MV3, IndexedDB, chrome.storage, Webpack, pnpm 10.33.0, node:test, Playwright.

**Spec:** [Incremental refactor design and ADR-001 through ADR-006](../../architecture/incremental-refactor-design.md).

## Execution record

The user subsequently authorized all six deliveries in one implementation run. A-F are implemented on `codex/incremental-architecture` in an attached worktree, preserving the primary checkout's existing changes. Local storage and verified sync are opt-in per-profile migrations, rather than silently activated personal-profile changes.

See [delivery decisions, current verification and remaining release gates](../../architecture/refactor-validation.md). This original step checklist remains the design/acceptance guide; it is not a claim that external signed-in Sync or older-binary acceptance was performed. Interface names were fitted to the existing publication/storage entry points: aggregate snapshot reads plus generation notifications replace separate module/settings read methods and partial notification payloads. The small collection favors one consistent reread over a second partial projection protocol.

Implemented deliveries:

- [x] A: typed boundaries, worker analysis, session capture/recovery and stable model identity.
- [x] B: transactional local publication, writer cutover admission, durable receipts/CSS obligations and unknown JS recovery.
- [x] C: verified revision protocol, causal/alias conflicts, outbox, format transition and local layout.
- [x] D: language adapter and bounded/versioned/shared declaration acquisition.
- [x] E: permission-gated MAIN one-off execution, document pinning and existing navigation timing.
- [x] F: consolidation, recovery round trip and validation/runbook updates.
- [ ] Release acceptance on real signed-in Chrome Sync, Chrome 135 cohort, actual older binaries and installed personal profiles.

## Global Constraints

- Preserve `packages/renderer`, `packages/runtime`, `packages/shared`, and `packages/monaco`, existing aliases, entry filenames, and transfer/import specifiers.
- Preserve every behavior in the design's Behavior contract. The `userScripts` permission/floor and any registration timing change are explicit later delivery changes, not assumed parity.
- Keep existing uncommitted changes intact. Establish the baseline from the current working tree, not HEAD; do not reset, stage broadly, commit, push, or amend without explicit authorization.
- No backend, new bundler, state-library replacement, full LSP stack, all-frame execution, SPA rerun, or npm runtime module system.
- Keep popup/background free of Monaco, Sass, Prettier, and TypeScript compiler runtime imports.
- Default to existing dependencies and native IndexedDB; add a package only if a documented implementation need remains. Test IndexedDB in the extension browser rather than assuming a mock proves transaction behavior.
- New API delivery proposes `minimum_chrome_version: "135"`; earlier deliveries retain the existing manifest. Verify the supported browser cohort before the API migration.
- The detailed original checklist below is an implementation/acceptance guide. Verified execution results and unavailable external checks are distinguished in refactor-validation.md.

## Review Focus

1. An older IDE window remains open during storage/backend activation: it must not continue writing through the retired authority (Tasks 4–6).
2. The user saves and keeps typing while compilation, formatting, or a metadata rename is in flight: newer text and undo history survive (Tasks 2–3).
3. A worker stops after commit or during JS execution: retry identifies the existing commit without blindly repeating JavaScript (Task 5).
4. Sync revisions/chunks/tombstones arrive out of order or concurrent devices edit the same script: keep the last complete local document and expose conflicts (Task 6).
5. Actual CSP, permission revocation, async dependencies, and unusual URL globs differ from the test harness: injection compatibility is established without bypassing browser controls (Task 8).

## Delivery sequence and stopping points

| Delivery                           | Tasks | User-testable result                                                      | Dependencies                     |
| ---------------------------------- | ----- | ------------------------------------------------------------------------- | -------------------------------- |
| A: Explicit boundaries             | 0–3   | Existing editor/save/injection works through tested contracts             | None                             |
| B: Transactional local publication | 4–5   | Cross-window writes, conflict detection, and restart-safe commit receipts | A                                |
| C: Reliable replication            | 6     | Complete verified sync revisions, recovery, explicit sync status          | B                                |
| D: Language acquisition hardening  | 7     | Same IntelliSense with versioned, bounded acquisition                     | A; coordinate with B/C contracts |
| E: Browser execution migration     | 8     | Explicit user-script permission and measured execution compatibility      | A/B graph and command contracts  |
| F: Consolidation                   | 9     | Obsolete paths removed, migration/release evidence complete               | All activated deliveries         |

Deliver and review these as separate changes. D and E are independently releasable from C once their declared prerequisites are satisfied. Do not bundle a failing later migration into an otherwise useful boundary refactor. A full rewrite is not a fallback requirement.

## File responsibility map

All paths below are repository-relative. Existing compatibility entry points remain until their callers and tests move.

| New location                                                                                              | Responsibility                                                                       |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/shared/src/publication/contracts.ts`                                                            | Document revisions, build snapshots, operation outcomes, prepared mutation contracts |
| `packages/shared/src/modules/manifest.ts`, `graph.ts`                                                     | Serializable module analysis and pure dependency/consumer planning                   |
| `packages/shared/src/storage/document-repository.ts`                                                      | Repository interface and backend-independent DTOs                                    |
| `packages/shared/src/storage/indexeddb/{database,repository,migration}.ts`                                | Schema, conditional transactions, shadow import/checkpointing                        |
| `packages/shared/src/storage/sync/{revision-codec,replication}.ts`                                        | v3 encoding/verification and pure causal merge rules                                 |
| `packages/renderer/src/shared/services/editor-session-service.ts`                                         | Live buffer capture and model/session lifecycle facade                               |
| `packages/renderer/src/shared/services/script-application-service.ts`                                     | Save preparation and separated commit/apply outcomes                                 |
| `packages/renderer/src/shared/services/publication-client.ts`                                             | Typed background command client and retries                                          |
| `packages/renderer/src/sandbox/module-analysis.ts`                                                        | TypeScript AST analysis, imported only by worker code                                |
| `packages/runtime/src/publication/{command-handler,coordinator,effects}.ts`                               | Validated local commands, transaction coordinator, recoverable effects               |
| `packages/runtime/src/sync/sync-service.ts`                                                               | Browser sync events, outbox delivery, ingestion                                      |
| `packages/runtime/src/ide/{execution-adapter,legacy-executor,user-scripts-executor,registration-plan}.ts` | Browser execution boundary and registration planning                                 |
| `packages/monaco/src/typescript/language-service.ts`, `type-package-resolver.ts`                          | Language adapter and versioned acquisition resolution                                |

## Shared interface decisions

Task 1 defines these in `publication/contracts.ts`; Tasks 2, 4, and 5 extend their specified companion types. Use interfaces for object shapes and discriminated unions for results. Every protocol boundary validates unknown input at runtime.

```ts
type Revision = string;
type ScriptBuffer = "typescript" | "scss" | "typeDefinitions";

interface SourceBuffers {
  typescript: string;
  scss: string;
  typeDefinitions: string;
}

interface SavedDocument {
  revision: Revision;
  script: Userscript; // storage-safe; compiled strings are empty
}

interface BuildSnapshot {
  scriptId: string;
  expectedRevision: Revision | null;
  buffers: SourceBuffers;
  shared: boolean;
  modulePath: string;
  minifyCompiledOutput: boolean;
  compilerContractVersion: number;
}

interface PreparedBuild {
  snapshot: BuildSnapshot;
  artifact: CompiledCodeEntry;
  manifest: ModuleManifest; // Task 2
}

interface ApplyOutcome {
  status: "not-requested" | "applied" | "partial" | "blocked" | "unknown";
  appliedTabCount: number;
  removedTabCount: number;
  staleSkipCount: number;
  message?: string;
}

type CommitOutcome =
  | { status: "committed"; requestId: string; documents: SavedDocument[] }
  | { status: "conflict"; current: SavedDocument[] }
  | { status: "rejected"; reason: string };
```

Document revisions change on any persisted entity mutation. Artifact identities use only compile-relevant inputs. Declaration edits do not invalidate JS/CSS solely because the document revision changed. Dependency execution freshness belongs to the complete execution plan, not unnecessarily to each separately transformed consumer artifact.

## Task 0: Pin the current behavior and test baseline

**Files:** Modify `AGENTS.md` only to correct verified script/test statements; add `docs/architecture/refactor-validation.md`; inspect `package.json`, `playwright.config.ts`, `scripts/check-manifest.mjs`, and existing `tests/` / `e2e/specs/`.

**Interfaces:** Produces a baseline ledger listing command, checkout state, outcome, and evidence location. No application behavior change.

- [ ] Run the full checks below on the current checkout; record actual failures, browser availability, and output sizes. Do not inherit old test counts or the obsolete draft-sync failure claim.
- [ ] Record the existing tests covering drafts, metadata, declaration saves, import/export, live output, shared imports, popup, CSS replacement, and startup no-op behavior. Add missing characterization assertions to the owning existing spec, not a duplicate suite.
- [ ] Add an extension-test option for enforced CSP in `e2e/fixtures/extension.fixture.ts`; retain existing suite behavior. A deliberately eval-blocking page must demonstrate that the enforced-CSP setup is actually active.
- [ ] Verify no compiler/Monaco dependencies appear in popup/background outputs; record current `check:manifest` results and startup audit measurements.
- [ ] Correct AGENTS.md root script/test instructions from those results without editing unrelated project guidance.

**Checkpoint:** Current extension remains usable; failures are attributed to this baseline before implementation begins.

## Task 1: Extract publication/application contracts without moving authority

**Files:** Create `publication/contracts.ts`, `storage/document-repository.ts`, `storage/legacy-document-repository.ts`, renderer `script-application-service.ts`; modify `userscript-publication.ts`, `draft-save-lifecycle.ts`, `publication-context.ts`, `thunks.save.ts`, and `messaging.ts`; add `tests/publication-contracts.test.mjs`, extend `tests/userscript-publication.test.mjs`.

**Interfaces:** `LegacyDocumentRepository.read(id: string): Promise<SavedDocument | null>` wraps current stores. Its opaque revision is a SHA-256 fingerprint of canonical storage-safe source/metadata, not `updatedAt`. `prepareSave(snapshot: BuildSnapshot): Promise<PreparedBuild>` becomes the compiler-facing boundary after Task 2. `saveScript(args: PersistScriptBuffersArgs): Promise<{ commit: CommitOutcome; apply: ApplyOutcome }>` is the application entry point; existing thunk response shapes adapt it for compatibility. This adapter does not claim cross-context atomic compare-and-swap.

- [ ] Add tests asserting source-commit success survives apply failure, old save completion leaves later text dirty, metadata updates preserve dirty buffers, and declaration-only save never invokes build/apply.
- [ ] Run the affected tests before edits; the new outcome-separation assertions should fail until the adapter exists.
- [ ] Inject storage/compiler/runtime dependencies into the application boundary. Keep ordered publication and accept-published timing inside the existing service. Keep current thunk/action names and selectors.
- [ ] Normalize exceptions into serializable outcomes at message boundaries; distinguish compilation, persistence, sync, and application failures in UI feedback.
- [ ] Run publication/draft/messaging tests and the draft-sync/apply browser specs. Check that runtime imports cannot reach renderer store types through the new contracts.

**Checkpoint:** Save, metadata, toggle, import, and popup behavior is preserved through explicit service contracts. Rolling back this delivery requires no data migration.

## Task 2: Introduce authoritative worker module analysis and build identities

**Files:** Create shared `modules/manifest.ts`, `modules/graph.ts`, sandbox `module-analysis.ts`; modify `build-worker.ts`, `compiler-transports.ts`, `compiler-requests.ts`, `compiler.ts`, `compile-helpers.ts`, shared `compile-metadata.ts`, `model.ts`, `resolve-shared-scripts.ts`, `workspace-closure.ts`, `apply-scope.ts`, runtime `injection-plan.ts`; add `tests/module-manifest.test.mjs`, extend compiler/graph/freshness tests and `e2e/specs/shared-imports.spec.ts`.

**Interfaces:** `analyzeModule(source: string): ModuleManifest` runs only in worker code. `ModuleManifest` contains `version: 1`, a source identity, runtime/type imports (specifier, module path, target `main|types`, binding kind), and structured unsupported-syntax diagnostics. `resolveModuleGraph(manifests, scripts): ResolvedModuleGraph` is pure and returns dependency-first IDs, affected consumers, unresolved/non-shared edges, and cycles. `PreparedBuild.manifest` carries analysis beside `artifact`. Add an `analyze` request to the existing correlated worker protocol; do not create an unrelated worker lifecycle.

- [ ] Test multiline imports, aliases/default/namespace imports, side effects, mixed type/value imports, comments/string lookalikes, export-from, dynamic imports, declaration imports, missing/shared/non-shared aliases, self-import, nested dependencies, and cycles. Assert type-only imports add no execution dependency.
- [ ] Test artifact invalidation on transform/compiler-contract changes and module identity/minification changes. Declaration-only edits must leave JS/CSS eligible; changed shared dependency artifacts must change the execution-plan identity.
- [ ] Implement AST analysis and canonical SHA-256 build identities off the UI thread. Bump compiled metadata with explicit legacy decoding; treat legacy artifacts as rebuildable rather than unreadable source.
- [ ] Persist graph manifests with artifacts; publish the full source snapshot identity atomically when the repository supports it. Until Task 5, retain existing ordered writes/freshness checks.
- [ ] Change runtime planning to consume current analyzed manifests. Never fall back to provisional regex results for executing an unverified graph. Missing manifests are stale and rebuild when the compiler host is available; no popup/background compiler is added.
- [ ] Keep existing non-shared-import saves valid, expose unavailable execution edges clearly, and test a dependency failure blocks its consumer while an independent sibling can still execute. Preserve supported namespace-transform semantics.
- [ ] Run focused compiler/graph tests, shared-import browser specs, and bundle checks. Stale bulk discovery must still reread current source before accepting output.

**Checkpoint:** One graph contract informs builds and execution; editor hints may remain provisional until Task 7 consumes the same graph. Legacy sources are preserved and artifacts can be rebuilt.

## Task 3: Encapsulate editor sessions and snapshot capture

**Files:** Create renderer `editor-session-service.ts`; modify `shared/CodeEditor.tsx`, `select-userscript.ts`, `draft-save-lifecycle.ts`, `workspace-service.ts`, `workspace-sync-plan.ts`, `useLiveCompiledOutput.ts`, `ide-workspace-lifetime.ts`, and declaration editor adapter; add `tests/editor-session-service.test.mjs`; extend existing draft/save/workspace/lifetime tests and draft-sync/live-output/type-declarations specs.

**Interfaces:** `createEditorSessionService(store, modelAdapter): EditorSessionService` returns `capture(scriptId: string): { buffers: SourceBuffers; modelVersions: Partial<Record<ScriptBuffer, number>> }`, `select(scriptId: string): void`, `acceptSaved(document: SavedDocument, captured): void`, `takeRemote(document: SavedDocument): void`, and `dispose(): void`. Use existing store/model adapter types internally; no Monaco object enters shared contracts or Redux. Define the captured type alongside the interface.

- [ ] Test save followed by typing, formatter completion after typing/switching, metadata alias rename while dirty, switch away/back, take-remote undo behavior, declaration-only saves, and teardown during startup/compilation. Assert exact text and dirty baselines, not only action counts.
- [ ] Implement the facade over existing draft reducers and canonical URI helpers. Capture live models before save/selection; retain one owner for store-to-model reconciliation. Remove competing capture paths only after their callers move.
- [ ] Keep Redux draft snapshots during this delivery. Keep model URIs unchanged; do not combine a resolver/URI migration with the ownership refactor.
- [ ] Route live preview through captured snapshots and generation-based acceptance. Preview results never write artifacts or sources.
- [ ] Add local draft recovery checkpoints keyed by script and window/session ID through a storage adapter. Restore a checkpoint against its base saved revision: exact-base restoration stays dirty; changed-base restoration raises a conflict; deleted sources remain recoverable drafts and are not recreated automatically.
- [ ] Run session/draft/workspace tests, then draft-sync/live-output/type-declarations/browser undo checks. Test reopening recovery after an interrupted checkpoint without corrupting the saved source.

**Checkpoint:** UI/Redux behavior remains familiar; sessions give all save/selection paths the same exact snapshot and preserve newer typing.

## Task 4: Add the transactional repository and a shadow migration

**Files:** Create shared `storage/indexeddb/database.ts`, `repository.ts`, `migration.ts`; extend `storage/document-repository.ts`; modify storage compatibility exports and renderer bootstrap only to start shadow verification; add `tests/document-repository.test.mjs`, `e2e/specs/storage-migration.spec.ts`.

**Interfaces:** `DocumentRepository.read(id): Promise<SavedDocument | null>`; `snapshot(): Promise<{ documents: SavedDocument[]; generation: number }>`; `commit(command: PreparedMutation): Promise<CommitOutcome>`; `readReceipt(requestId): Promise<CommitOutcome | null>`. Define `PreparedMutation` variants for create/save/metadata/enable/delete/import-batch/module/settings in `publication/contracts.ts`, including request ID, expected revisions, prepared artifacts/manifests where applicable, and explicit desired enabled state. Add versioned module/settings records with `readModules()` and `readSettings()` repository methods; their mutations return committed receipts with an empty `documents` list and typed changed-record references. Store schema v1 has documents, modules, settings, artifacts, receipts, tombstones, outbox, sync heads/conflicts, and migration metadata.

- [ ] Test conditional competing writes, duplicate request IDs, delete versus delayed save, duplicate module aliases across two scripts, atomic import batches, and transaction abort. Assert no half source/artifact/receipt state is visible.
- [ ] Implement short IndexedDB transactions. Hashing, compilation, network, and Chrome API calls occur before/after them. Validate the alias index and expected revisions in the same transaction as writes.
- [ ] Implement idempotent shadow import from legacy raw/v2 source and local compiled storage. Read scripts/artifacts only; keep settings/modules handled by their explicit records. Retain undecodable legacy entries and their diagnostics; never mark an incomplete import complete.
- [ ] Reconcile changes observed during migration, compare canonical source/metadata and artifact eligibility, and record a verified generation. A migration flag alone does not establish parity.
- [ ] Run real IndexedDB browser tests with interrupted import, concurrent legacy write, failed open/version upgrade, empty profile, and multiple options windows. Verify legacy storage remains authoritative and untouched.

**Checkpoint:** The same extension runs on its original backend, with a verified local mirror. This is the last trivial backend rollback point.

## Task 5: Move local commit ownership to the background

**Files:** Create runtime `publication/command-handler.ts`, `coordinator.ts`, `effects.ts`, renderer `publication-client.ts`; modify shared `messages.ts`, runtime `background.ts`/runtime handler, renderer save/CRUD/import/compile/modules/settings/conflict thunks, `useStorageSync.ts`, popup/store, and storage readers; add `tests/publication-coordinator.test.mjs`, `tests/publication-protocol.test.mjs`, `e2e/specs/multi-window-publication.spec.ts` and `publication-recovery.spec.ts`.

**Interfaces:** `executePublication(command: PreparedMutation): Promise<CommitOutcome>` validates and commits. `PublicationClient.execute(command): Promise<CommitOutcome>` retries the same request ID. `publicationCommitted` carries request ID, typed changed/deleted record references (`script|module|settings`), and repository generation; clients reread those records through Task 4 methods. `getOperationStatus(requestId)` supplies persisted commit and separate effect state. Remote ingestion also uses this coordinator. State-dependent metadata preparation reads a revision, builds outside the transaction, and retries on a conditional conflict.

- [ ] Test options A versus options B, popup desired-enable versus an IDE save, metadata changes versus a build, delete versus rebuild, alias collisions, module/settings writes, conflict keep-local races, and a retried import batch. A stale conflict action cannot resolve a newer observation.
- [ ] Validate unknown command payloads and trusted extension sender contexts; reject page/user-script mutation messages. Never trust a claimed `source` string as authentication. Verify prepared source/build identities and dependency expectations.
- [ ] Add the background coordinator using Task 4 transactions. Commit source/artifact/receipt/outbox together. Separate durable commit acknowledgement from later tab feedback.
- [ ] Activate the new repository only at a coordinated startup boundary. Existing updated-code windows receive `backendChanged` and rehydrate without losing dirty sessions. Windows without the protocol must reload before activation; do not run dual authorities or pretend old code can be remotely patched.
- [ ] Route every participating writer through commands, including metadata, toggle, import, conflicts, modules, build settings, and stale rebuild publication. Replace toggle inversion with explicit desired state plus revision/retry semantics.
- [ ] Read back current intent before each pending CSS/registration effect. Serialize effects per tab/document and affected dependency set. A superseded disable must not remove CSS after a newer enable. Record JS execution started/completed; interrupted execution becomes `unknown`, never automatic replay.
- [ ] Kill/restart the actual service worker before commit, after commit-before-reply, and during apply. Assert one durable commit, current CSS intent, preserved drafts, and honest unknown JS status. Notifications missed during sleep are repaired by repository generation refresh.
- [ ] Run multi-window/recovery and all existing workflow specs. Confirm popup toggling has no compiler dependency. Keep a legacy read/export path for recovery, not a second writer.

**Checkpoint:** One transactional local authority; independent windows cannot silently overwrite a revision. Until Task 6, a durable outbox uses the legacy sync codec through a serialized replication adapter, with existing inbound complete-source/conflict checks and clearly documented cross-device limits.

## Task 6: Migrate sync to complete immutable revisions

**Files:** Create shared `storage/sync/revision-codec.ts`, `replication.ts`, runtime `sync/sync-service.ts`; modify legacy sync reader, reconciliation adapters, runtime startup, settings storage-status panel, local UI state storage adapter; add `tests/sync-revision-codec.test.mjs`, `tests/sync-replication.test.mjs`, `e2e/specs/sync-recovery.spec.ts`.

**Interfaces:** `encodeSyncRevision(document, parents: Revision[]): Promise<EncodedSyncRevision>` returns immutable revision-qualified chunks and a version-3 manifest with script/revision IDs, causal parents, encoding, exact byte length, chunk count, SHA-256 digest, and tombstone state. `decodeSyncRevision(manifest, chunks): Promise<DecodedSyncRevision | { status: "incomplete" | "corrupt" }>` verifies before promotion. `mergeSyncRevision(localHeads, incoming): { status: "advance" | "duplicate" | "conflict"; heads: Revision[] }` follows causal ancestry, never wall-clock last-writer-wins.

- [ ] Test reordered manifests/chunks, missing and mixed-revision chunks, corrupt length/hash, duplicate delivery, deletion before source, concurrent edits, clock skew, delayed old revisions after delete, and quota exhaustion. Assert unchanged last-complete local source for every incomplete/corrupt input.
- [ ] Write immutable chunks before publishing the manifest; retry outbox delivery with bounded backoff. Track verified parents/heads and remote conflicts in the local transaction. Keep remote source and dirty-draft conflicts distinct; even clean local editors must not erase a concurrent remote branch silently.
- [ ] Ingest verified remote revisions through Task 5, invalidate affected artifacts, and schedule rebuild when an options compiler host is available. Until then, show pending-build state and skip stale execution; do not add a background Sass/compiler host.
- [ ] Keep raw/v2 read support and snapshot/export recovery. Enable v3 only after the supported synced browser cohort is upgraded. Preserve legacy records until a verified migration/recovery export exists; do not claim mixed old-writer/v3 operation is safe.
- [ ] Define retention without assuming global acknowledgements: never prune unresolved conflict heads, referenced parent metadata, or necessary tombstones; clean only orphaned incomplete payloads that are not reachable from retained heads. Check quota before writes and report blocked replication while retaining the local commit.
- [ ] Migrate current layout values to local window/session state; continue syncing saved sources and portable preferences. Show local-save success separately from pending/failed sync. Do not silently sync drafts.
- [ ] Run real-browser interrupted-delivery tests and two separate profiles with controlled replicated payload transfer; record this as protocol simulation. Perform a separate real Chrome Sync acceptance check before claiming cross-device sync validation.

**Checkpoint:** Local work remains available during sync failures; only verified remote revisions become visible. Downgrade after v3 activation requires explicit controlled export/restore, not a feature-flag flip.

## Task 7: Put language intelligence and acquisition behind stable adapters

**Files:** Create Monaco `typescript/language-service.ts`, `type-package-resolver.ts`; modify `defaults.ts`, `cdn-types.ts`, `cdn-type-deps.ts`, completion helpers, workspace-service/projection, module dialog/validation, and shared `GlobalModule` codec; add `tests/type-package-resolver.test.mjs`; extend CDN/completion/ambient tests and type-declarations/shared-import/module specs.

**Interfaces:** `LanguageServiceAdapter.reconcile(projection: LanguageWorkspaceProjection): Promise<void>` preserves current model URI semantics and stock worker behavior. Define `LanguageWorkspaceProjection` in the Monaco adapter using its existing `WorkspaceFile[]`, module paths, and versioned CDN declaration inputs; the renderer maps its `WorkspaceProjection` into that input, so Monaco never imports renderer implementation types. `resolveTypePackage({ packageName, version }): Promise<ResolvedTypePackage>` returns an exact version, entry file, and declaration files/dependencies. Add optional declaration-version metadata to `GlobalModule` with legacy defaults; cache keys include resolver schema, package, and resolved version. Runtime CDN URL/version is a separate explicit field/contract and is never rewritten implicitly.

- [ ] Pin own ambient globals, exported import-only declarations, unrelated-script isolation, imports introduced in dirty sources, alias rename/delete, auto-import before opening a dependency, and disposal after selection changes. Run the existing tests as acceptance requirements.
- [ ] Consume Task 2 analysis for completion legality/dependency scope while keeping all required source models available for existing auto-import behavior. Clearly distinguish editor-only non-shared references from runnable dependencies.
- [ ] Implement exact-version declaration entry resolution using package metadata and supported `types`/`typings`/exports/subpath rules; report unsupported rules explicitly. Cache negative confirmed missing results separately from temporary network failures.
- [ ] Deduplicate requests; cap each acquisition at 50 declaration files/package, 10 transitive packages, and 5 MiB total declaration bytes, with 15-second per-request timeout and cancellation. Surface an explicit limit/fetch error rather than pretending a truncated graph is complete.
- [ ] Test warm-cache offline operation, stale-generation completion, version changes, transitive ranges, cancellation, network timeouts, missing package versus failed transport, and duplicate libraries sharing declarations. Bounds are acquisition limits, not script-size limits.
- [ ] Keep stock Monaco and active ambient-model rules. Introduce a project-aware worker only in a separate scoped follow-up if these isolation tests cannot pass; no full LSP implementation is required by this delivery.

**Checkpoint:** Same editor capabilities through a replaceable adapter; exact declaration cache identities and honest acquisition status. This task does not require the sync migration.

## Task 8: Migrate execution behind a compatibility-tested browser adapter

**Files:** Create runtime `ide/execution-adapter.ts`, `legacy-executor.ts`, `user-scripts-executor.ts`, `registration-plan.ts`; modify `scripts.ts`, runtime/navigation/tab handlers, shared message/outcome types, `public/manifest.json`, popup/options capability UI, and fixture/config for enforced-CSP project; add `tests/registration-plan.test.mjs`, `e2e/specs/user-scripts-execution.spec.ts`, `user-scripts-permission.spec.ts`.

**Interfaces:** `ExecutionAdapter.execute({ tabId, documentId, code, world: "MAIN", injectImmediately }): Promise<ExecutionOutcome>` reports completed/failed/unknown. `detectExecutionCapability(): Promise<"ready" | "permission-required" | "unsupported">` attempts an API method, not just property existence. `planRegistrations(snapshot): RegistrationPlan` is pure and emits desired registrations, unsupported glob/timing reasons, and dependency initialization requirements.

- [ ] Extract the legacy executor with zero behavior change and verify current apply/CSS/navigation specs first. Preserve the existing executor solely for earlier releases until the new release is ready.
- [ ] Add the `userScripts` permission and Chrome 135 floor only in this delivery. Implement one-off MAIN-world execution while retaining legacy navigation triggers and current timing semantics. Disabled/revoked API access produces actionable capability status; do not route around it through eval.
- [ ] Test with CSP enforcement active: page globals, strict page CSP, top-frame behavior, nested/async shared dependencies, optional CDN globals, failed dependency isolation, live apply, repeated explicit apply, and CSS replacement/disable. Do not declare MAIN-world CSP exemption from USER_SCRIPT-world documentation.
- [ ] Test the exact glob corpus (`*`, `?`, schemes, query/fragment, escaping, empty patterns, file/restricted pages) against the current matcher and browser eligibility. Unsupported pages are reported honestly; never widen execution to approximate a pattern.
- [ ] Verify dependency execution is deliberately awaited and separate JS tasks preserve current shared namespace lifetime. Do not register several independently ordered async scripts and assume initialization order.
- [ ] Prototype automatic registrations after one-off parity. Preserve legacy triggers in the released adapter unless registration can match current completion timing and matching; otherwise document/register a separately accepted timing improvement. Restore registrations on extension update and reconcile stale registrations on deletion/disable/revocation recovery.
- [ ] Test real browser permission enable/disable while pages stay open, missing toggle before first run, extension update, navigation/apply races, and worker restart. Record API availability setup separately from test results; mocks or test-only bypass flags do not prove user enablement.

**Checkpoint:** The new API can ship independently after parity and capability UX pass. If exact registration parity is infeasible, ship validated one-off execution with existing triggers; do not force a rewrite or claim guaranteed document-start behavior.

## Task 9: Remove retired authority paths and establish release evidence

**Files:** Modify obsolete renderer publication/storage adapters, runtime legacy executor after cutover, shared compatibility exports, `AGENTS.md`, `scripts/README.md`, `docs/architecture/refactor-validation.md`, and affected tests. Keep legacy data decoders/recovery tooling for the documented upgrade window.

**Interfaces:** No new public contract. The task removes unused paths after every consumer has migrated.

- [ ] Search all direct `chrome.storage` and repository write callsites. Assert script/module/build-setting mutations have one coordinated authority; exempt documented UI preferences, caches, recovery checkpoints, and CSS session bookkeeping.
- [ ] Remove retired orchestration and duplicate model/capture ownership; retain compatibility readers and import/export. Tests should exercise public contracts, with direct pure-helper tests where algorithms warrant them.
- [ ] Run the full checks below on the activated configuration, plus each migration/recovery/enforced-CSP suite. Compare bundle/startup measurements with Task 0. Fix regressions or document a narrowly measured budget change; do not hide failures by increasing timeouts or disabling assertions.
- [ ] Manually exercise the built unpacked extension: edit all buffers, save while typing, switch/reload, toggle through popup, reopen recovery, import/export examples, nested modules, offline warm-cache editing, settings rebuild, remote conflict, and restricted-page feedback.
- [ ] Complete data upgrade/downgrade rehearsal on a disposable profile and real Chrome Sync acceptance on two controlled profiles. Record source counts/digests, recovered conflicts, outstanding sync/builds, and actual browser version.
- [ ] Update ADR statuses per delivered stage and document deferred custom worker/stable URI/automatic registration decisions. Do not label an unactivated migration complete.

**Checkpoint:** A working extension with evidence tied to the built artifact and activated backend; no remaining competing source writers.

## Verification commands

Run in repository-root PowerShell. Build environment values should be saved/restored if the shell already defines them. Avoid repo-wide formatting while unrelated changes exist.

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.tools.json --noEmit
pnpm lint
$env:TS_NODE_PROJECT = 'tsconfig.tools.json'
$env:NODE_OPTIONS = '--loader ts-node/esm'
pnpm build
pnpm check:manifest
pnpm e2e:headless
```

For focused unit runs, use the existing loaders explicitly:

```powershell
node --import ./tests/register-ts-node.mjs --import ./tests/register-aliases.mjs --test tests/userscript-publication.test.mjs tests/draft-save-lifecycle.test.mjs
pnpm exec playwright test e2e/specs/draft-sync.spec.ts e2e/specs/apply.spec.ts
```

Expected result: exit 0, with required assets present; ordinary Webpack size warnings do not invalidate a successful build. Build before browser tests. If Chromium is unavailable, establish an approved installed-browser path or install the matching Playwright browser; never report browser checks as passed from source tests.

Each implementation task adds its named tests to the appropriate focused invocation. The enforced-CSP project must explicitly set `bypassCSP: false` in its actual persistent-context fixture; project config alone is insufficient if the fixture ignores it. Record any pre-existing typecheck/lint failures instead of expanding this refactor to unrelated cleanup.

## Rollout, recovery, and execution handoff

- A, D, and the executor extraction are ordinary code rollbacks with unchanged durable formats.
- Task 4 shadow mode can be disabled while legacy storage remains authoritative.
- Once Task 5 accepts new local writes, recovery must export the latest local committed documents/outbox before switching authorities. Never point readers at stale legacy records.
- Once Task 6 emits v3, downgrade requires an explicit export/restore procedure and stopping old writers on synced profiles. Backups are retained until rehearsal proves restoration.
- Execution switches must never run both injectors for the same document. A user disabling User Scripts stops that executor rather than enabling a hidden alternate route.
- Commit each delivery only if separately authorized, using explicit file paths. Do not commit the user's unrelated current changes.

Recommended execution: native sequential implementation, one delivery at a time using `executing-plans`, because save/session/repository contracts are tightly coupled and a staged migration is easier to reason about with one consistent owner. The user subsequently authorized implementation of all six deliveries in one go. Review the design/ADRs and delivery scope before executing.
