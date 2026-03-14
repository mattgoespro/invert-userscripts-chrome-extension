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
  useRef,
  useState,
} from "react";

/** How long to wait after the last UI state change before flushing to chrome.storage.sync. */
const SAVE_DEBOUNCE_MS = 500;

type GlobalStateContextValue = {
  uiState: GlobalState;
  updateUIState: (partial: Partial<GlobalState>) => void;
  updatePanelSizes: (partial: Partial<GlobalStateSizes>) => void;
};

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

/**
 * Provides persisted UI state (sidebar tab, selected script, panel sizes, drawer state)
 * to the entire options page. Loads from chrome.storage.sync before rendering children,
 * ensuring all defaultSize props see the correct values on first mount.
 */
export function GlobalStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [uiState, setUIState] = useState<GlobalState>(
    GlobalStateManager.defaultState
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    GlobalStateManager.get().then((state) => {
      setUIState(state);
      setIsLoaded(true);
    });
  }, []);

  const scheduleSave = useCallback((state: GlobalState) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      GlobalStateManager.save(state);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateGlobalState = useCallback(
    (partial: Partial<GlobalState>) => {
      setUIState((prev) => {
        const next = { ...prev, ...partial };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const updatePanelSizes = useCallback(
    (partial: Partial<GlobalStateSizes>) => {
      setUIState((prev) => {
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

  if (!isLoaded) {
    return null;
  }

  return (
    <GlobalStateContext.Provider
      value={{ uiState, updateUIState: updateGlobalState, updatePanelSizes }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
}

/**
 * Consumes the UI state context. Must be used within a {@link GlobalStateProvider}.
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
