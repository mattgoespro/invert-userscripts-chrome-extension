import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as redux from "@reduxjs/toolkit";
import { initialUiState } from "../packages/renderer/src/shared/store/slices/ui/state.ui.ts";
import workspaceReducer, {
  setScriptErrors,
} from "../packages/renderer/src/shared/store/slices/workspace/index.ts";
import * as errorComparison from "../packages/renderer/src/shared/store/slices/workspace/error-comparison.ts";

function loadModule(relativePath, dependencies) {
  const source = readFileSync(
    new URL(`../packages/renderer/src/${relativePath}`, import.meta.url),
    "utf8"
  );
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      console,
      setTimeout,
      clearTimeout,
      require(name) {
        assert.ok(name in dependencies, `Missing dependency ${name}`);
        return dependencies[name];
      },
    }
  );
  return exports;
}

test("unchanged panel sizes preserve state identity and do not dispatch; real changes do", () => {
  const ui = loadModule("shared/store/slices/ui/index.ts", {
    "@reduxjs/toolkit": redux,
    "../userscripts": {
      setCurrentUserscript: redux.createAction(
        "userscripts/setCurrentUserscript"
      ),
    },
    "../userscripts/thunks.userscripts": {
      createUserscript: redux.createAsyncThunk("create", async () => {}),
    },
    "./state.ui": { initialUiState },
    "./thunks.ui": {
      hydrateUi: redux.createAsyncThunk("hydrate", async () => {}),
    },
  });
  const actions = [];
  const store = redux.configureStore({
    reducer: { ui: ui.default },
    middleware: (getDefault) =>
      getDefault().concat(() => (next) => (action) => {
        actions.push(action);
        return next(action);
      }),
  });
  const initial = store.getState();
  store.dispatch(ui.updatePanelSizesIfChanged({ ...initial.ui.panelSizes }));
  assert.equal(actions.length, 0);
  store.dispatch(ui.updatePanelSizes({ ...initial.ui.panelSizes }));
  assert.equal(store.getState(), initial);
  store.dispatch(
    ui.updatePanelSizesIfChanged({ scriptCodeEditorHorizontalSplit: 60 })
  );
  assert.equal(actions.length, 2);
  assert.equal(
    store.getState().ui.panelSizes.scriptCodeEditorHorizontalSplit,
    60
  );
  assert.equal(
    store.getState().ui.panelSizes.scriptListSidebarWidth,
    initial.ui.panelSizes.scriptListSidebarWidth
  );
  store.dispatch(
    ui.updatePanelSizesIfChanged({ scriptCodeEditorHorizontalSplit: 60 })
  );
  assert.equal(actions.length, 2);
});

test("diagnostic tracking ignores empty/repeated markers, publishes changed ranges and clears errors", () => {
  let markers = [],
    notify,
    cleanup,
    ids = 0,
    promotions = 0;
  const actions = [];
  const store = redux.configureStore({
    reducer: { workspace: workspaceReducer },
    middleware: (getDefault) =>
      getDefault().concat(() => (next) => (action) => {
        actions.push(action);
        return next(action);
      }),
  });
  const monaco = {
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    editor: {
      getModelMarkers: () => markers,
      onDidChangeMarkers: (listener) => {
        notify = listener;
        return { dispose() {} };
      },
      setModelMarkers: () => {
        promotions++;
      },
    },
  };
  const hook = loadModule("shared/hooks/useEditorErrorTracking.ts", {
    react: {
      useEffect: (effect) => {
        cleanup = effect();
      },
      useRef: (current) => ({ current }),
    },
    "monaco-editor": monaco,
    "@/shared/store/hooks": {
      useAppDispatch: () => store.dispatch,
      useAppStore: () => store,
    },
    "@/shared/store/slices/workspace": { setScriptErrors },
    "@/shared/store/slices/workspace/error-comparison": errorComparison,
    "@shared/utils": { uuid: () => `error-${++ids}` },
  });
  const model = {
    uri: { toString: () => "file:///test.ts" },
    isDisposed: () => false,
  };
  hook.useEditorErrorTracking("script", model, "typescript");
  assert.equal(actions.length, 0);
  markers = [
    {
      severity: 2,
      message: "hint",
      code: "123",
      startLineNumber: 1,
      startColumn: 2,
      endLineNumber: 1,
      endColumn: 3,
    },
  ];
  notify([model.uri]);
  const first = store.getState();
  assert.equal(actions.length, 1);
  assert.equal(promotions, 1);
  notify([model.uri]);
  assert.equal(actions.length, 1);
  assert.equal(ids, 1);
  assert.equal(store.getState(), first);
  markers = [{ ...markers[0], endColumn: 4 }];
  notify([model.uri]);
  assert.equal(actions.length, 2);
  assert.equal(promotions, 2);
  markers = [];
  notify([model.uri]);
  assert.equal(actions.length, 3);
  assert.equal(
    store.getState().workspace.scriptErrors.script.typescript.length,
    0
  );
  notify([model.uri]);
  assert.equal(actions.length, 3);
  const cleared = store.getState();
  store.dispatch(
    setScriptErrors({ scriptId: "script", language: "typescript", errors: [] })
  );
  assert.equal(store.getState(), cleared);
  cleanup();
});

test("workspace ignores unrelated dispatches, coalesces relevant changes and switches immediately", async () => {
  const projections = [];
  const disposable = () => ({ dispose() {} });
  const workspace = loadModule("shared/services/workspace-service.ts", {
    "@/sandbox/compiler": {
      analyzeUserscriptModule: async (source) => ({
        version: 1,
        source,
        imports: [],
        diagnostics: [],
      }),
    },
    "@packages/monaco": {
      ensureTypescriptDefaults() {},
      registerModuleSpecifierCompletion: disposable,
    },
    "@shared/model": { getScriptModulePath: (script) => script.moduleName },
    "../utils/quick-fix-provider": { registerBespokeCodeActions: disposable },
    "./workspace-sync-plan": {
      projectWorkspace: (input) => {
        projections.push(input);
        return null;
      },
    },
  });
  const initial = {
    userscripts: { scripts: {}, currentScriptId: "one" },
    editorDrafts: { drafts: {} },
    modules: { modules: {} },
  };
  const store = redux.configureStore({
    reducer: (state = initial, action) =>
      action.type === "replace" ? action.payload : state,
  });
  const stop = workspace.startWorkspaceService(store);
  try {
    store.dispatch({ type: "noop" });
    store.dispatch({
      type: "replace",
      payload: { ...store.getState(), ui: {}, workspace: {} },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(projections.length, 1);
    store.dispatch({
      type: "replace",
      payload: { ...store.getState(), editorDrafts: { drafts: { one: {} } } },
    });
    store.dispatch({
      type: "replace",
      payload: {
        ...store.getState(),
        userscripts: {
          ...store.getState().userscripts,
          currentScriptId: "two",
        },
      },
    });
    assert.equal(projections.length, 2);
    assert.equal(projections[1].currentScriptId, "two");
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(projections.length, 2);
    store.dispatch({
      type: "replace",
      payload: { ...store.getState(), modules: { modules: { changed: {} } } },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(projections.length, 3);
  } finally {
    stop();
  }
});
