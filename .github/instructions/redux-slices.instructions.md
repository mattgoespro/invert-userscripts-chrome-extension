---
applyTo: "packages/renderer/src/shared/store/**"
description: "Redux Toolkit slice conventions: createAsyncThunk patterns, RTK selectors API, storage quota stripping, file structure, and typed hooks for the Invert IDE store."
---

# Redux Toolkit Slice Conventions

## File Structure

Each slice lives in its own subdirectory under `packages/renderer/src/shared/store/slices/`:

```text
slices/<slice-name>/
  index.ts              ← createSlice definition, selectors, reducer export
  state.<slice-name>.ts ← State type + initialState constant
  thunks.<slice-name>.ts ← All createAsyncThunk definitions
```

- **`index.ts`**: The slice definition (`createSlice`), exported action creators, exported selectors, and the default reducer export.
- **`state.*.ts`**: A named state type (e.g., `UserscriptsState`, `SettingsState`) and an exported `initialState` constant.
- **`thunks.*.ts`**: All `createAsyncThunk` definitions for the slice. Thunks are imported into `index.ts` for use in `extraReducers`.

If a slice has no async operations, it may omit the thunks file (see `monaco-editor` slice which inlines its `EditorState` type).

## createAsyncThunk Import

Always import `createAsyncThunk` from `@reduxjs/toolkit/react` — **not** from `@reduxjs/toolkit`:

```typescript
import { createAsyncThunk } from "@reduxjs/toolkit/react";
```

## Typed Hooks

Components must use the typed hooks from `@/shared/store/hooks`:

```typescript
import { useAppDispatch, useAppSelector, useAppStore } from "@/shared/store/hooks";
```

Never use untyped `useDispatch`, `useSelector`, or `useStore` directly.

## RTK Selectors API

Define selectors using the built-in `selectors` property on `createSlice` — **not** as standalone functions outside the slice:

```typescript
const exampleSlice = createSlice({
  name: "example",
  initialState,
  selectors: {
    selectSomething(state: ExampleState) {
      return state.something;
    },
  },
  // ...
});

export const { selectSomething } = exampleSlice.selectors;
```

For memoized or computed selectors, use `createSelector` from `@reduxjs/toolkit` **outside** the slice definition, then call it from within a slice selector:

```typescript
import { createSelector, createSlice } from "@reduxjs/toolkit";

const selectFilteredMemo = createSelector(
  (state: ExampleState) => state.items,
  (items) => items.filter((item) => item.active)
);

const exampleSlice = createSlice({
  name: "example",
  initialState,
  selectors: {
    selectFiltered(state: ExampleState) {
      return selectFilteredMemo(state);
    },
  },
  // ...
});
```

For parameterized cross-slice selectors that need `RootState`, define them as standalone factory functions after the slice:

```typescript
export const selectRelatedItems = (id: string) =>
  createSelector(
    (state: RootState) => state.otherSlice.items,
    (items): RelatedItem[] => { /* ... */ }
  );
```

## Reducers with Prepare Callbacks

When a reducer receives a bare primitive (e.g., a string ID) but the reducer needs a structured payload, use the `prepare` callback pattern:

```typescript
reducers: {
  setCurrentItem: {
    prepare: (id: string) => {
      return { payload: { id } };
    },
    reducer: (state, action: PayloadAction<{ id: string }>) => {
      state.currentItem = state.items[action.payload.id];
    },
  },
},
```

## Storage Quota Stripping Pattern

When persisting to `chrome.storage.sync` (8KB per-key quota), **strip compiled code** before saving. Keep full compiled code only in Redux state:

```typescript
export const updateUserscript = createAsyncThunk<Userscript, Userscript, { state: RootState }>(
  "userscripts/updateUserscript",
  async (script: Userscript) => {
    // Save storage-safe version without compiled code to preserve quota
    const storageScript: Userscript = {
      ...script,
      code: {
        source: script.code.source,
        compiled: {
          javascript: "",
          css: "",
        },
      },
    };
    await ChromeSyncStorage.updateScript(script.id, storageScript);
    // Return full version with compiled code for Redux state
    return script;
  }
);
```

## extraReducers Pattern

Use the `builder` callback pattern for handling thunk lifecycle states:

```typescript
extraReducers: (builder) => {
  builder
    .addCase(loadData.pending, (state) => {
      state.isLoading = true;
    })
    .addCase(loadData.fulfilled, (state, action) => {
      state.data = action.payload;
      state.isLoading = false;
    })
    .addCase(loadData.rejected, (state) => {
      state.isLoading = false;
    });
},
```

## Thunk Action Type Prefix

Use the slice name as the prefix for thunk action types: `"<sliceName>/<actionName>"`:

```typescript
createAsyncThunk("userscripts/loadUserscripts", async () => { /* ... */ });
createAsyncThunk("settings/updateSettings", async () => { /* ... */ });
createAsyncThunk("editor/saveEditorCode", async () => { /* ... */ });
```

## Cross-Slice Thunk Dispatch

Thunks may dispatch actions from other slices using the `dispatch` parameter from the thunk API:

```typescript
export const saveEditorCode = createAsyncThunk(
  "editor/saveEditorCode",
  async (args, { dispatch }) => {
    await dispatch(updateUserscriptCode({ /* ... */ })).unwrap();
    return result;
  }
);
```

## Store Configuration

The store is configured in `store.ts` with three slice reducers (`userscripts`, `settings`, `editor`), `redux-logger` middleware (collapsed, diff mode), and Redux DevTools named `"Invert IDE Userscripts"`. Slice keys in the store must match the slice `name`.

## Exports

- **Actions**: Named exports from `sliceName.actions`
- **Selectors**: Named exports from `sliceName.selectors`
- **Reducer**: Default export (`export default sliceName.reducer`)
- **Thunks**: Named exports from the thunks file (imported by `index.ts` for `extraReducers`, imported by components for dispatch)
- **State type**: Named export from the state file (imported by `index.ts` for selector type annotations)
