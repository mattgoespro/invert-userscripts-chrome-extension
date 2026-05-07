# Feature: Import/Export Userscripts

Write a plan to implement a feature to import/export all userscripts from/to a single JSON file.

## File Format

The exported file has the following JSON schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Userscripts",
  "type": "object",
  "properties": {
    "userscripts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
          "enabled": {
            "type": "boolean"
          },
            "type": "string"
          },
          "urlPatterns": {
              "type": "string"
              "type": "string"
            }
          "runAt": {
            "type": "string",
            "enum": ["beforePageLoad", "afterPageLoad"]
          },
          },
          "moduleName": {
            "type": "string"
          },
          "sources": {
            "type": "object",
            "properties": {
              "typescript": {
                "type": "string"
              "typescript-declarations": {
                "type": "string"
              },
              },
              "scss": {
                "type": "string"
              }
            }
          },
          "sharedImports": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "globalModuleImports": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      }
    }
  }
}
```

## Import Flow

When the user imports scripts, the UI follows the following user flow:

1. A dialog is shown with a single disabled input (with the `type=file` attribute) that shows the selected file path, and an `Select` button to trigger the file selection dialog, laid side-by-side. There is an `Import` button at the bottom of the dialog that is initially disabled.
2. When the `Select` button is clicked, a native browser file selector dialog opens and the user selects a userscripts JSON file.
3. After a file is selected, the file is validated against the file schema (above).
   - If there are validation errors, the dialog remains open and the validation errors are shown in the dialog, and the `Import` button is disabled (if its enabled). The user can reselect a file until a valid file is selected.
   - If validation is successful, the currently loaded global modules are checked against the set of `globalModuleImports` referenced by the file.
   - If some referenced global module IDs are not currently loaded in the extension, the dialog remains open, a warning list is shown, and the `Import` button remains enabled.
   - If the user proceeds with the import, missing global module IDs are removed from the imported userscripts before the scripts are persisted.
4. When the `Import` button is clicked, a loading overlay gets shown over the script list component as the userscripts file is parsed and processed.
5. The imported userscripts from the file are added to the script list component

## Export Flow

When the user exports userscripts, all of the current userscripts are simply exported in the JSON format enforced by the file schema.

## Updated Script List Component

The script list component will have a new menu triggered by an options icon button. The menu will have an:

- `Import` button: triggers the UI flow described in [Import Flow](#import-flow)
- `Export` button: triggers an immediate file export described in [Export Flow](#export-flow)

## Notes

If you have any questions about the UI flows or other feature functionality, use the `vscode_askQuestions` tool to ask questions.

## Clarifications

- `urlPatterns` are plain strings, not URI-typed schema values.
- `globalModuleImports` contains global module IDs.
- Missing global module IDs should be surfaced as warnings after file selection and stripped from imported scripts if the user continues.
- Exported userscripts also include `enabled` and `runAt`.
- `sources` also includes `typescript-declarations`.

## Implementation Plan

### 1. Add the scripts list actions in the options page shell

- Extend the scripts sidebar header in `packages/renderer/src/options/invert-ide/pages/scripts-page/ScriptsPage.tsx` with a new options `IconButton` beside the existing create button.
- Reuse the existing panel/menu pattern from `packages/renderer/src/options/invert-ide/pages/scripts-page/script-editor/script-metadata/options-panel/OptionsPanel.tsx` so the new trigger opens a small actions menu with `Import` and `Export` buttons.
- Keep this behavior in the options page instead of the shared `ScriptList` component because the popup also consumes `ScriptList` and should not gain import/export controls.

### 2. Build a dedicated import dialog for file selection, validation, and warnings

- Create a dialog component under the scripts page, following the structure used by `packages/renderer/src/options/invert-ide/pages/modules-page/add-module-dialog/AddModuleDialog.tsx` and the shared `Dialog` component.
- The dialog should manage:
  - the selected file and displayed path
  - the parsed JSON payload
  - blocking validation errors
  - non-blocking missing-module warnings
  - whether the `Import` button is enabled
- Implement the specified file row as a disabled file input plus a `Select` button that programmatically opens the native file chooser.
- On each new file selection, clear prior errors and warnings, parse the JSON, validate the payload shape, then check referenced `globalModuleImports` against the currently loaded modules from storage.

### 3. Add a userscript import/export transfer layer

- Add a small transfer module near the userscripts slice that defines the external JSON shape and the mapping functions for:
  - internal userscript -> export entry
  - parsed import entry -> normalized internal userscript draft
- Exported entries should include:
  - `name`
  - `enabled`
  - `urlPatterns`
  - `runAt`
  - `moduleName`
  - `sources.typescript`
  - `sources.typescript-declarations`
  - `sources.scss`
  - `sharedImports`
  - `globalModuleImports`
- For shared imports, serialize stable shared script references rather than internal ids. The current model strongly suggests using shared module names for interchange because ids are extension-local.
- For global modules, export the stored module ids exactly as provided in `globalModuleImports`.

### 4. Implement export from current Redux and storage state

- Add an export action handler in the scripts page that gathers the current scripts from the userscripts slice and any needed global/shared lookup data.
- Generate a formatted JSON document from the transfer mapper and trigger a browser download with a `Blob` and temporary object URL.
- Keep export synchronous from the user perspective: clicking `Export` should immediately produce the file download without opening a dialog.

### 5. Implement import as a userscripts thunk

- Add a new thunk in `packages/renderer/src/shared/store/slices/userscripts/thunks.userscripts.ts` to import a validated file payload.
- The thunk should:
  - load current userscripts and global modules from storage
  - normalize each imported entry into a full internal `Userscript`
  - generate new internal ids and timestamps
  - preserve imported `enabled`, `runAt`, and source fields
  - initialize `status`, compiled output placeholders, and any missing optional fields required by the internal model
  - resolve `sharedImports` into internal shared script ids
  - strip missing `globalModuleImports` ids based on the warning check outcome
  - compile TypeScript and SCSS using the existing compiler helpers
  - persist metadata/source to `chrome.storage.sync`
  - persist compiled output to `chrome.storage.local`
  - return the imported scripts so the slice can merge them into state
- Keep this in the userscripts slice so the feature stays aligned with the existing compile-and-persist pipeline.

### 6. Add import progress and merge behavior to the scripts page

- Track import progress in Redux or local page state and use it to show a blocking overlay over the script list container while the import thunk is running.
- Keep schema validation failures and missing-module warnings inside the dialog.
- After a successful import, close the dialog, clear transient state, and let the list rerender with the newly merged scripts.
- Do not delete or replace existing scripts; append imported scripts to the existing set.

### 7. Update slice reducers and selectors only where needed

- Extend the userscripts slice reducers to merge imported scripts into the existing record without disturbing the current selection unless the UI explicitly wants to select one of the new imports.
- Avoid a full reload if the thunk can return the imported scripts directly.
- Reuse the existing selectors and typed hooks rather than creating parallel state access paths.

### 8. Validate the feature end to end

- Manually verify the import dialog states:
  - no file selected
  - invalid JSON/schema
  - valid file with missing module warnings
  - valid file with no warnings
- Verify export includes the corrected fields and the expected source payloads.
- Verify import appends scripts, recompiles outputs, preserves shared relationships, strips missing global modules, and shows the loading overlay only during processing.
- Run the production build after implementation.
