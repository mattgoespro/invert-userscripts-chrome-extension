import {
  GlobalState,
  GlobalStateManager,
  GlobalStateSizes,
} from "@shared/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** How long to wait after the last global state change before flushing to chrome.storage.sync. */
const SAVE_DEBOUNCE_MS = 500;

type GlobalStateContextValue = {
  globalState: GlobalState;
  updateGlobalState: (partial: Partial<GlobalState>) => void;
  updatePanelSizes: (partial: Partial<GlobalStateSizes>) => void;
};

const GlobalStateContext = createContext<GlobalStateContextValue>(null);

/**
 * Provides persisted global state (sidebar tab, selected script, panel sizes, drawer state)
 * to the entire options page. Loads from chrome.storage.sync before rendering children,
 * ensuring all defaultSize props see the correct values on first mount.
 */
export function GlobalStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [globalState, setGlobalState] = useState<GlobalState>(
    GlobalStateManager.defaultState
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const latestStateRef = useRef<GlobalState>(GlobalStateManager.defaultState);

  useEffect(() => {
    GlobalStateManager.get().then((state) => {
      latestStateRef.current = state;
      setGlobalState(state);
      setIsLoaded(true);
    });
  }, []);

  const flushSave = useCallback((state?: GlobalState) => {
    const nextState = state ?? latestStateRef.current;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    void GlobalStateManager.save(nextState);
  }, []);

  const scheduleSave = useCallback((state: GlobalState) => {
    latestStateRef.current = state;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void GlobalStateManager.save(state);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const handlePageHide = () => {
      flushSave();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushSave();
    };
  }, [flushSave, isLoaded]);

  const updateGlobalState = useCallback(
    (partial: Partial<GlobalState>) => {
      setGlobalState((prev) => {
        const next = { ...prev, ...partial };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const updatePanelSizes = useCallback(
    (partial: Partial<GlobalStateSizes>) => {
      setGlobalState((prev) => {
        const next = {
          ...prev,
          panelSizes: { ...prev.panelSizes, ...partial },
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const contextValue = useMemo(
    () => ({
      globalState,
      updateGlobalState,
      updatePanelSizes,
    }),
    [globalState, updateGlobalState, updatePanelSizes]
  );

  if (!isLoaded) {
    return null;
  }

  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
}

/**
 * Consumes the global state context.
 */
export function useGlobalState(): GlobalStateContextValue {
  const context = useContext(GlobalStateContext);

  if (!context) {
    throw new Error(
      "The `useGlobalState` hook can only be used in a component tree wrapped by `<GlobalStateProvider>`."
    );
  }

  return context;
}
