---
name: "Runtime Package: Injection Instructions"
description: "Use when working with runtime script injection: timing boundaries, deduplication, MAIN-world JavaScript injection, and separate CSS insertion."
applyTo: "packages/runtime/src/**"
---

# Runtime Script Injection

The runtime package coordinates several coupled injection phases. Preserve the behavior contract unless the task explicitly changes it.

- `injectMatchingScripts(tabId, url, timing)` filters enabled scripts by URL pattern and `runAt` before it merges compiled artifacts from `CompiledCodeStorage`.
- Injection order matters: inject enabled CDN modules first, then shared-script dependencies, then userscript JavaScript, then compiled CSS.
- Deduplicate CDN modules by module ID and shared scripts by userscript ID within a single injection pass.
- Shared import/export rewriting is already done at compile time in `@shared/compiled-output`. Runtime injection should treat `script.code.compiled.javascript` as final, injection-ready code.
- JavaScript injection uses `chrome.scripting.executeScript` with `world: "MAIN"` and a temporary `<script>` element. CSS injection uses `chrome.scripting.insertCSS`. Do not collapse these paths together.
- Timing is split across handlers: `tab.handler.ts` injects `beforePageLoad`, `navigation.handler.ts` injects `afterPageLoad`, and `runtime.handler.ts` reruns both timings for `"refreshTabs"`.
- If you change stored script fields or injection order, review the runtime handlers and badge updates together so refresh behavior stays coherent.
