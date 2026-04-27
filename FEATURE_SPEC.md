# Invert IDE Feature Specification

**Document Version:** 1.0
**Date:** April 23, 2026
**Status:** Approved for Implementation

This document specifies five major features designed to enhance the Invert IDE Chrome extension, focusing on improving the userscript development experience for individual developers.

---

## Table of Contents

1. [Command Palette (Quick Actions)](#1-command-palette-quick-actions)
2. [Script Analytics Dashboard](#2-script-analytics-dashboard)
3. [Inline Error Annotations with Quick Fixes](#3-inline-error-annotations-with-quick-fixes)
4. [Live URL Pattern Tester](#4-live-url-pattern-tester)
5. [Import Intelligence](#5-import-intelligence)

---

## 1. Command Palette (Quick Actions)

### Overview

A keyboard-driven command launcher that provides fuzzy search access to all IDE actions, scripts, and navigation. Accessible via `Cmd/Ctrl+K`.

### Visual Design

**Style:** Spotlight/Raycast aesthetic

- Clean, minimal interface
- Center-screen modal overlay
- Keyboard shortcuts displayed alongside actions
- Emphasis on search input with clear typography

**Layout:**

```
┌─────────────────────────────────────────────┐
│ search query                                │  ← Input field
├─────────────────────────────────────────────┤
│ 1  Create New Script                  ⌘N    │  ← Numbered results
│ 2  Delete Current Script              ⌘⌫    │
│ 3  Format Code                        ⇧⌘F   │
│ 4  my-youtube-script                        │  ← Script results
│ 5  reddit-enhancer                          │
└─────────────────────────────────────────────┘
```

### Action Categories

**Included Categories:**

1. **Navigation** — Go to Scripts/Modules/Settings pages
2. **Script Operations** — Create, Delete, Duplicate, Toggle scripts
3. **Editor Actions** — Format Code, Save, Toggle panels, Focus editor
4. **Quick Script Switch** — Fuzzy search all scripts by name for instant navigation
5. **Settings Quick Access** — Change theme, adjust font size, toggle auto-format

**Excluded Categories:**

- Recent Scripts (use Quick Script Switch instead)
- Custom User Commands (defer to future release)

### Search Capabilities

**Scope:**

- Action names and keywords
- Script titles
- **Full content search** — Search inside TypeScript/SCSS code across all scripts

**Algorithm:**

- Fuzzy matching with `fuzzysort` library (12KB, high performance)
- Built-in aliases for common actions:
  - `new` → Create New Script
  - `del` → Delete Script
  - `fmt` → Format Code
  - `save` → Save Current Script
- No custom user-defined aliases

**Result Ranking:**

1. Exact matches (highest priority)
2. Prefix matches
3. Fuzzy matches
4. Content matches (lowest priority)

### Context-Aware Suggestions

**Implementation:** Subtle hints (badges/icons on relevant actions)

**Triggers:**

- Script has no URL patterns → Badge on "Add URL Pattern" action
- Unsaved changes exist → Badge on "Save Current Script"
- Multiple modified scripts → "Save All (3)" action with count
- Script is shared but unused → "View potential dependencies"

**Display:** Small badge or icon next to suggested actions, not prominently featured

### Keyboard Navigation

**Core Controls:**

- `↑` `↓` — Navigate results
- `Enter` — Execute selected action
- `Esc` or `Cmd/Ctrl+K` again — Close palette
- `→` — Expand sub-actions (if present)
- `1`-`9` — **Quick-select** first 9 results (Spotlight style)

**Sub-Actions:**

- Some commands support nested actions revealed via `→` or hover
- Example: "Create New Script" → "From Scratch" / "From Template" / "Duplicate Existing"

### Persistence & History

**Recent Actions:**

- Track last 10 commands used
- **Persistent across sessions** (stored in `chrome.storage.sync`)
- Display at top when palette opens with empty input
- Learn user patterns over time (most-used actions float to top)

### Position

**Location:** Center screen (centered modal overlay)

### Technical Implementation

**Component Structure:**

```typescript
CommandPalette/
  ├── CommandPalette.tsx              // Main container
  ├── CommandPaletteInput.tsx         // Search input with fuzzy matching
  ├── CommandPaletteResults.tsx       // Results list with keyboard nav
  │   ├── CommandPaletteGroup.tsx     // Optional section headers
  │   └── CommandPaletteItem.tsx      // Individual result
  └── CommandPaletteProvider.tsx      // Context for command registration
```

**Command Registry:**

```typescript
interface Command {
  id: string;                    // Unique identifier
  label: string;                 // Display name
  category: CommandCategory;     // For grouping
  icon?: LucideIcon;            // Optional icon
  keywords?: string[];          // Aliases for fuzzy matching
  shortcut?: string;            // Display keyboard shortcut
  action: () => void | Promise<void>;
  when?: () => boolean;         // Conditional visibility
  subActions?: Command[];       // Nested commands
}
```

**Global Keyboard Handler:**

```typescript
// Register at app root to intercept Cmd+K before Monaco
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  return () => window.removeEventListener('keydown', handler, { capture: true });
}, []);
```

**Fuzzy Search:**

- Library: `fuzzysort` (12KB, high performance)
- Search targets: Command labels, keywords, script names, script content
- Debounced search with 100ms delay for responsiveness

**Storage:**

```typescript
// Persist recent actions in chrome.storage.sync
interface CommandPaletteState {
  recentActions: string[];  // Command IDs, max 10
  actionUsageCount: Record<string, number>;  // For ranking
}
```

---

## 2. Script Analytics Dashboard

### Overview

Track real-world script performance, execution patterns, and errors to help developers understand how their userscripts behave in production.

### Location

**Placement:** New dedicated tab in sidebar navigation

- Sidebar tabs: Scripts / Modules / **Analytics** / Settings
- Full-page layout matching Scripts/Modules pages

### Core Metrics

**Tracked Per Script:**

1. **Injection Count** — Total number of times script has been injected
2. **Last Execution Time** — Timestamp of most recent execution
3. **Error Count & Logs** — Errors caught during execution with full context
4. **Execution Duration** — Time taken to execute (milliseconds)
5. **Top Matching URLs** — Which URLs triggered this script most often
6. **Memory Impact** — Heap size before/after script execution

### Dead Script Detection

**Threshold:** Flag scripts that haven't run in **90+ days**

**Display:**

- Badge on script in Scripts page
- Suggestion in Analytics tab: "This script hasn't run in 95 days — Review URL patterns or archive?"
- Non-intrusive (no blocking modals)

### Visualizations

**Dashboard Layout:**

1. **Usage Heatmap**
   - Grid or list showing most/least used scripts
   - Color intensity represents injection frequency
   - Click to drill into per-script details

2. **Timeline Chart**
   - Line graph of injections over time
   - Filterable by script or view all scripts aggregated
   - Time ranges: Last 7 days, 30 days, 90 days, All time

3. **Health Status Cards**
   - Per-script cards showing:
     - Success/error ratio
     - Average execution time
     - Last run timestamp
     - Status indicator (healthy/warning/error)
   - Color-coded: Green (healthy), Yellow (warnings), Red (errors)

4. **URL Pattern Effectiveness**
   - Table showing which patterns match most frequently
   - Highlight patterns that never match (potential misconfigurations)
   - Show example URLs that matched each pattern

5. **Comparative Stats**
   - Side-by-side comparison of selected scripts
   - Useful for identifying performance regressions
   - Metrics: Execution time, error rate, injection count

### Data Retention

**Policy:** **Indefinite retention**

- All historical data preserved
- No auto-purge
- Manual cleanup available via settings (future enhancement)

**Storage:**

- Use `chrome.storage.local` for analytics data (5MB+ capacity)
- Separate from script metadata in `chrome.storage.sync`

### Data Collection

**Method:** **Message-based reporting**

**Flow:**

1. Background worker injects instrumentation wrapper around each userscript
2. Wrapper captures:
   - Start time (before execution)
   - End time (after execution)
   - Memory snapshot (if tracking enabled)
   - Any thrown errors with full context
3. Wrapper sends analytics event to background worker via `chrome.runtime.sendMessage`
4. Background worker aggregates data and persists to `chrome.storage.local`

**Message Format:**

```typescript
interface AnalyticsEvent {
  scriptId: string;
  timestamp: number;
  url: string;
  duration: number;  // milliseconds
  memoryDelta?: number;  // bytes
  error?: {
    message: string;
    stack: string;
    timestamp: number;
  };
}
```

### Error Tracking

**Detail Level:** **Full error context**

**Captured Data:**

- Error message
- Full stack trace
- Timestamp
- URL where error occurred
- Script ID and name
- Browser/OS info (from user agent)

**Display:**

- Error log viewer in Analytics tab
- Group similar errors
- One-click "Jump to error line" in editor
- Filter by script, time range, error type

### Performance Impact

**Strategy:** **Opt-in per script**

**Implementation:**

- Checkbox in script metadata: "Enable analytics tracking"
- Default: OFF for new scripts
- When disabled, only basic metrics collected (injection count, last run time)
- When enabled, full instrumentation active (duration, memory, errors)

**Rationale:**

- Gives developers control over performance trade-offs
- Critical production scripts can disable tracking
- Development scripts can enable full diagnostics

### Data Export

**Status:** Not included in initial release

- Future enhancement if users request it

---

## 3. Inline Error Annotations with Quick Fixes

### Overview

Surface TypeScript and SCSS compilation errors directly in the Monaco editor with visual indicators and one-click fixes.

### Error Visualization

**Display Methods (all active simultaneously):**

1. **Squiggly Underlines**
   - Red squiggles under problematic code (Monaco native markers)
   - Standard editor convention

2. **Gutter Icons**
   - Icons in left margin (line number area)
   - Clickable to jump to error or trigger quick fix
   - Color-coded: Red (error), Yellow (warning)

3. **Hover Tooltips**
   - Hover over squiggled code → tooltip with full error message
   - Include quick fix suggestions in tooltip

4. **Tab Badge**
   - Error/warning count badge on editor tab header
   - Example: "script.ts (3)" where 3 = error count
   - Click badge to open error panel

### Severity Levels

**Two Levels:**

1. **Errors** (red) — Compilation failures, type errors
2. **Warnings** (yellow) — Non-critical issues, linting suggestions

**No Info level** — Keep it simple (errors vs. warnings only)

### Quick Fixes

**Implemented Fixes:**

1. **Auto-Import Shared Scripts**
   - Detect missing import for shared script function/type
   - Quick fix: Add `import { ... } from "shared/module-name"`
   - Intelligently place import at top of file

2. **Extract to Shared Script**
   - Identify repeated code patterns across scripts
   - Quick fix: "Extract to new shared script"
   - Wizard to name new shared module and select exported members

3. **Add Type Annotations**
   - Detect implicit `any` on function parameters or variables
   - Quick fix: Add explicit type (`: string`, `: number[]`, etc.)
   - Suggest type based on usage context

4. **Wrap in Error Handler**
   - Quick fix for code that may throw errors
   - Wraps selection in `try { ... } catch (error) { ... }`
   - Customizable catch block template

5. **Generate Documentation**
   - Quick fix on functions missing JSDoc comments
   - Generate stub with `@param`, `@returns`, `@description` tags
   - Infer types from TypeScript signatures

**Trigger:**

- Lightbulb icon in gutter when cursor on error line
- Keyboard shortcut: `Cmd+.` (standard VS Code quick fix)
- Hover tooltip includes "Quick Fix" button

### Error Panel

**Location:** New tab in output drawer (alongside JavaScript / CSS tabs)

**Layout:**

```
// output
┌─────────────────────────────────────────────┐
│ [JS] [CSS] [ERRORS]                         │  ← Tab headers
├─────────────────────────────────────────────┤
│ ⚠ Warning: Implicit any on parameter 'value'│
│   Line 12, Column 5 — script.ts             │
│   [Quick Fix]                               │
│                                             │
│ ❌ Error: Cannot find name 'myFunction'     │
│   Line 24, Column 10 — script.ts            │
│   [Quick Fix] [Go to Line]                  │
└─────────────────────────────────────────────┘
```

**Features:**

- List all errors/warnings for current script
- Click error → jump to line in editor
- Click "Quick Fix" → apply fix without leaving panel
- Real-time updates as code changes
- Clear all button to dismiss transient warnings

### Error Explanations

**Status:** No AI explanations in initial release

**Rationale:**

- Avoid external API dependencies
- Keep extension lightweight and offline-capable
- Future enhancement: Built-in explanations for common TypeScript errors

### Monaco Integration

**Implementation:**

```typescript
// Register error markers with Monaco
monaco.editor.setModelMarkers(model, 'typescript', [
  {
    startLineNumber: 12,
    startColumn: 5,
    endLineNumber: 12,
    endColumn: 20,
    message: "Parameter 'value' implicitly has an 'any' type",
    severity: monaco.MarkerSeverity.Warning,
    code: '7006',
  }
]);

// Register code action provider for quick fixes
monaco.languages.registerCodeActionProvider('typescript', {
  provideCodeActions: (model, range, context) => {
    const actions: monaco.languages.CodeAction[] = [];

    context.markers.forEach(marker => {
      if (marker.code === '7006') {
        actions.push({
          title: 'Add type annotation',
          kind: 'quickfix',
          edit: { ... },
          isPreferred: true
        });
      }
    });

    return { actions, dispose: () => {} };
  }
});
```

**Error Sources:**

1. TypeScript language service (built-in diagnostics)
2. SCSS compiler errors (from Sass sandbox)
3. Custom linting rules (future: ESLint integration)

---

## 4. Live URL Pattern Tester

### Overview

A testing interface that validates URL patterns in real-time against user-provided URLs, eliminating guesswork in pattern creation.

### Location

**Display:** Separate modal overlay

**Trigger:**

- Button in ScriptMetadata panel: "Test Patterns" (next to URL pattern input)
- Command Palette action: "Test URL Patterns"
- Keyboard shortcut: `Cmd+Shift+T` when focused on URL pattern field

**Rationale for Modal:**

- Provides focused testing environment without cluttering main editor
- Can test patterns from any script (not just current)
- Allows comparison testing across multiple scripts

### Test URL Input Methods

**Supported Inputs:**

1. **Manual URL Input**
   - Text field to paste URLs for testing
   - Validates URL format (must be valid HTTP/HTTPS)
   - Supports multiple URLs (one per line)

2. **Test Open Tabs**
   - Button: "Test Against Open Tabs"
   - Queries `chrome.tabs.query()` for all open tab URLs
   - Displays results showing which tabs match

3. **Recent History URLs**
   - Dropdown showing last 20 visited URLs from `chrome.history`
   - Click to add to test list
   - Respects browser privacy settings (incognito excluded)

**Not Included:**

- Common site examples (users prefer real URLs they care about)

### Visual Feedback

**Match Result Display:**

1. **Match Icons**
   - ✓ (green checkmark) for matching patterns
   - ✗ (red X) for non-matching patterns
   - Icon appears next to each pattern

2. **Color Highlighting**
   - Matching patterns: green background
   - Non-matching patterns: default background
   - Test URL: highlight matched portion

3. **Match Breakdown**
   - Show which part of the URL matched the pattern
   - Display glob-to-regex conversion visually:

     ```
     Pattern: https://youtube.com/watch?v=*
     Test URL: https://youtube.com/watch?v=dQw4w9WgXcQ

     Match: ✓
     Matched portion: [https://youtube.com/watch?v=][dQw4w9WgXcQ]
                       (literal)                   (wildcard)
     ```

**UI Layout:**

```
┌─────────────────────────────────────────────┐
│ URL Pattern Tester                    [×]   │
├─────────────────────────────────────────────┤
│ Test URL:                                   │
│ [https://youtube.com/watch?v=dQw4w9WgXcQ ]  │
│                                             │
│ [Test Open Tabs] [Recent History ▾]        │
├─────────────────────────────────────────────┤
│ Patterns:                                   │
│                                             │
│ ✓ https://youtube.com/watch?v=*            │
│   └─ Matched: /watch?v=dQw4w9WgXcQ         │
│                                             │
│ ✗ https://youtube.com/playlist?list=*      │
│   └─ No match (different path)             │
└─────────────────────────────────────────────┘
```

### Smart Pattern Suggestions

**Enabled:** Yes

**Functionality:**

- Analyze provided test URL
- Suggest glob patterns based on URL structure:
  - Exact match: `https://example.com/page`
  - Domain wildcard: `https://example.com/*`
  - Subdomain wildcard: `https://*.example.com/*`
  - Path segment wildcard: `https://example.com/*/details`
- Display suggestions as clickable chips below input
- Click to add suggestion to script's URL patterns

**Algorithm:**

```typescript
function suggestPatterns(url: string): string[] {
  const parsed = new URL(url);
  return [
    url,                                    // Exact match
    `${parsed.origin}/*`,                   // Domain wildcard
    `${parsed.protocol}//*.${parsed.hostname}/*`, // Subdomain wildcard
    `*://${parsed.hostname}${parsed.pathname}`,   // Protocol agnostic
    `*://${parsed.hostname}/*`,             // Full domain wildcard
  ];
}
```

### Pattern Conflicts

**Warnings:** Disabled

**Rationale:**

- Multiple scripts matching the same URL is often intentional
- Shared scripts + consumer scripts intentionally overlap
- Warnings would create false alarms

**Future Consideration:**

- Opt-in conflict detection in Analytics tab (not in tester)

### Regex Visualization

**Display:** Hidden (no regex shown)

**Rationale:**

- Regex is an implementation detail
- Users think in glob patterns, not regex
- Reduces cognitive load
- Future enhancement: "Advanced view" toggle to show regex for debugging

### Persistence

**State Saved:**

- Last tested URL persists per-script (in `chrome.storage.sync`)
- Modal remembers last position/size (future enhancement)

**Not Saved:**

- Test results (ephemeral)
- Open tabs snapshot (dynamic)

---

## 5. Import Intelligence

### Overview

Provide IDE-grade intellisense for shared scripts and global CDN modules, making dependency management seamless.

### Auto-Complete Triggers

**Activation Conditions:**

1. **On `import` keyword**
   - Type `import` → Monaco suggests available shared scripts
   - Shows: `import { ... } from "shared/module-name"`
   - Filters suggestions as user types

2. **On `shared/` path**
   - Type `from "shared/` → Suggests module names
   - Auto-complete module name based on available shared scripts
   - Example: `"shared/log` → suggests `"shared/logger"`

**No Manual Trigger Required** (Ctrl+Space works but not needed)

**Monaco Implementation:**

```typescript
monaco.languages.registerCompletionItemProvider('typescript', {
  triggerCharacters: ['"', "'", '/'],
  provideCompletionItems: (model, position) => {
    const line = model.getLineContent(position.lineNumber);

    if (line.includes('from "shared/') || line.includes("from 'shared/")) {
      return {
        suggestions: sharedScripts.map(script => ({
          label: script.moduleName,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: script.moduleName,
          detail: script.name,
          documentation: `Shared script: ${script.name}\nExports: ${getExports(script)}`
        }))
      };
    }

    return { suggestions: [] };
  }
});
```

### Import Preview

**Methods:**

1. **Hover Tooltips**
   - Hover over module name in import statement
   - Tooltip shows:
     - Exported functions and their signatures
     - Exported types
     - Module description (if available)
   - Example:

     ```
     Module: logger

     Exports:
       • log(message: string): void
       • error(message: string, error: Error): void
       • LogLevel: type
     ```

2. **Peek Definition**
   - `Alt+F12` or right-click → "Peek Definition"
   - Opens inline panel showing shared script source code
   - Editable inline (changes reflect in shared script)
   - Close with `Esc` or click outside

**No Full Source Modal** (Peek Definition sufficient)

### Go to Definition

**Enabled:** Yes

**Functionality:**

- `Cmd+Click` or `F12` on shared module name → Opens shared script in editor
- Navigates to Scripts tab and selects the shared script
- Cursor positioned at export location

**Use Cases:**

- Jump from consumer script to shared script
- Trace dependency chain
- Edit shared code directly

### Find All Usages

**Enabled:** Yes

**Functionality:**

- Right-click shared script in Scripts list → "Find All Usages"
- Shows list of scripts importing this shared module
- Click result → Jump to import line in that script

**Display:**

- Panel or modal showing:

  ```
  Usages of "logger" (3):

  my-youtube-script.ts
    Line 1: import { log } from "shared/logger"

  reddit-enhancer.ts
    Line 3: import { log, error } from "shared/logger"

  twitter-utils.ts
    Line 2: import { LogLevel } from "shared/logger"
  ```

**Implementation:**

- Search all scripts for `from "shared/{moduleName}"`
- Parse import statements with regex or TypeScript AST
- Cache results for performance

### Dependency Warnings

**Implemented Warnings:**

1. **Missing Import Errors**
   - Red squiggle if importing non-existent shared script
   - Error message: "Cannot find module 'shared/xyz'. Did you mean 'shared/xyz-util'?"
   - Quick fix: Remove import or create new shared script

2. **Circular Dependency Warnings**
   - Detect cycles: Script A imports B, B imports A
   - Yellow squiggle with warning: "Circular dependency detected: A ↔ B"
   - Link to dependency graph visualizer (future feature)

**Not Implemented:**

- Unused import hints (too noisy for rapid prototyping)

**Real-Time Detection:**

- Validate on every import statement change
- Background worker computes dependency graph
- Updates Monaco markers on graph change

### Global Module Type Definitions

**Method:** **Auto-fetch from DefinitelyTyped**

**Workflow:**

1. User adds CDN module in Modules page with package name (e.g., `lodash`)
2. Background worker fetches types from `@types/{packageName}` via CDN:
   - Primary: `https://cdn.jsdelivr.net/npm/@types/{packageName}/index.d.ts`
   - Fallback: `https://unpkg.com/@types/{packageName}/index.d.ts`
3. Types registered with Monaco TypeScript worker via `addExtraLib()`
4. Auto-complete and type checking work immediately

**Error Handling:**

- If types not found, log warning but continue
- Module still available at runtime (injected globally)
- Users see runtime types but no intellisense

**Type Declaration Management:**

```typescript
// In monaco package
export async function syncCdnModuleTypes(modules: CdnModuleInfo[]) {
  for (const module of modules) {
    try {
      const types = await fetchTypesFromCDN(module.packageName);
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        types,
        `file:///node_modules/@types/${module.packageName}/index.d.ts`
      );
    } catch (error) {
      console.warn(`Could not fetch types for ${module.packageName}`, error);
    }
  }
}
```

**Manual Type Upload:** Not included

- Future enhancement if CDN fetching insufficient
- Users can manually edit global .d.ts file (future)

---

## Implementation Priority

### Phase 1: Foundation (Weeks 1-2)

1. Command Palette (high impact, foundational)
2. Inline Error Annotations (critical for DX)

### Phase 2: Intelligence (Weeks 3-4)

3. Import Intelligence (leverages Monaco capabilities)
4. Live URL Pattern Tester (focused, self-contained)

### Phase 3: Analytics (Weeks 5-6)

5. Script Analytics Dashboard (complex, requires background instrumentation)

---

## Technical Dependencies

### New NPM Packages

- `fuzzysort` (Command Palette fuzzy search)
- `d3` or `recharts` (Analytics visualizations) — TBD based on design

### Chrome APIs

- `chrome.history.search()` (URL Pattern Tester — Recent History)
- `chrome.tabs.query()` (URL Pattern Tester — Test Open Tabs)
- `chrome.runtime.sendMessage()` (Analytics data collection)

### Monaco Editor APIs

- `monaco.editor.setModelMarkers()` (Error annotations)
- `monaco.languages.registerCodeActionProvider()` (Quick fixes)
- `monaco.languages.registerCompletionItemProvider()` (Import autocomplete)
- `monaco.languages.typescript.typescriptDefaults.addExtraLib()` (Type definitions)

### Storage Requirements

- `chrome.storage.sync`: Command Palette state (~1KB)
- `chrome.storage.local`: Analytics data (unbounded, monitor quota)
- In-memory: Dependency graph, error cache

---

## Design Tokens & Styling

All features must follow the established Invert IDE design system:

- **Typography:** JetBrains Mono for code, Outfit for headings
- **Colors:** Use semantic tokens (`--accent`, `--surface-base`, `--text-muted`)
- **Spacing:** `gap-sm`, `p-md`, `mt-lg` utilities
- **Components:** Use custom component library (Button, Input, Panel, etc.)
- **Animations:** `animate-panel-enter`, `transition-colors duration-150`

### Component Patterns

**Command Palette:**

- Overlay with `z-100`, `backdrop-blur-sm`
- Input with `font-mono`, `text-lg`
- Results with `scrollbar-thin`, `hover:bg-hover-overlay`

**Analytics Charts:**

- Card-based layout with `EditorPanel` wrapper
- Syntax-colored chart legends (`--syntax-keyword`, etc.)
- Monospace axis labels

**Error Panel:**

- Tab integration matching existing `ScriptEditorDrawer` pattern
- Error items with gutter icons (Lucide icons)
- Hover states with `--hover-overlay`

**URL Pattern Tester Modal:**

- Centered modal with `rounded-default`, `border-accent`
- Input fields with `font-mono` for URLs/patterns
- Match results with `text-accent` (green) and `text-danger` (red)

**Import Tooltips:**

- Monaco-native tooltip styling
- Syntax highlighting with Shiki theme tokens
- Monospace font for code signatures

---

## Success Metrics

### Command Palette

- 80%+ of actions accessible via palette within 3 keystrokes
- <100ms search response time for 100+ scripts

### Analytics Dashboard

- <50ms overhead per script injection (with tracking enabled)
- <1MB storage per 1000 script executions

### Error Annotations

- 100% parity with TypeScript language service errors
- <200ms latency from code change to error marker update

### URL Pattern Tester

- 100% accuracy in pattern matching (matches runtime behavior exactly)
- Support 50+ patterns tested simultaneously without lag

### Import Intelligence

- Auto-complete suggestions appear within 100ms of typing
- 95%+ accuracy in shared script export detection

---

## Future Enhancements (Out of Scope)

Deferred to future releases:

- Custom user commands in Command Palette
- Analytics data export (JSON/CSV)
- AI-powered error explanations
- Manual type definition upload for CDN modules
- Conflict warnings in URL Pattern Tester
- Regex visualization toggle
- Dependency graph visualizer (tree/graph UI)
- Script version control / Git integration
- Collaborative script marketplace

---

## Document History

| Version | Date           | Author         | Changes               |
| ------- | -------------- | -------------- | --------------------- |
| 1.0     | April 23, 2026 | Copilot + User | Initial specification |

---

**End of Specification**
