import type { Page } from "@playwright/test";

export interface RecordedAction {
  type: string;
  payload?: unknown;
}

/** Observe reducer actions through DevTools, independently of console logging. */
export async function installReduxAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface Action {
      type: string;
      payload?: unknown;
    }
    type Reducer = (state: unknown, action: Action) => unknown;
    type Creator = (reducer: Reducer, preloadedState?: unknown) => unknown;
    type Enhancer = (create: Creator) => Creator;
    const target = window as typeof window & {
      __reduxAuditActions: Action[];
      __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: (
        options: unknown
      ) => (...enhancers: Enhancer[]) => Enhancer;
    };
    target.__reduxAuditActions = [];
    target.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ =
      () =>
      (...enhancers) =>
      (create) =>
      (reducer, preloadedState) => {
        const enhanced = enhancers.reduceRight(
          (next, enhancer) => enhancer(next),
          create
        );
        return enhanced((state, action) => {
          const next = reducer(state, action);
          if (!action.type.startsWith("@@")) {
            target.__reduxAuditActions.push({
              type: action.type,
              payload: action.payload,
            });
          }
          return next;
        }, preloadedState);
      };
  });
}

export async function readReduxActions(page: Page): Promise<RecordedAction[]> {
  return page.evaluate(
    () =>
      (window as typeof window & { __reduxAuditActions: RecordedAction[] })
        .__reduxAuditActions
  );
}
