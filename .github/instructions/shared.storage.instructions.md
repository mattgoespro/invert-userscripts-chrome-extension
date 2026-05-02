---
name: "Shared Package: Storage Instructions"
description: "Use when working with shared storage managers: sync-vs-local responsibilities, defaults-on-read, keyed records, and nested merge persistence."
applyTo: "packages/shared/src/storage/**"
---

# Shared Storage Managers

Storage helpers in this repo intentionally split responsibilities across Chrome storage areas.

- `chrome.storage.sync` stores userscript metadata, UI state, settings, modules, and command-palette data. Compiled JavaScript/CSS lives in `chrome.storage.local` via `CompiledCodeStorage`.
- Treat persisted objects as partial input. `ChromeSyncStorage`, `CommandPaletteStorage`, and `GlobalStateManager` merge defaults on read instead of assuming storage already contains a full schema.
- Preserve nested merges for structured state. `GlobalStateManager.get()` merges `panelSizes` separately from the top-level object; matching provider code relies on that behavior.
- Most writers load the current keyed object, update it in memory, then write the full keyed record back. Avoid partial nested writes that would drop sibling fields.
- `CompiledCodeStorage` uses `compiled:{scriptId}` keys and stores build metadata with the compiled output. Keep that prefix contract stable unless you also migrate existing local storage.
- When adding a new persisted field, update the corresponding defaults and every loader that hydrates that structure.
