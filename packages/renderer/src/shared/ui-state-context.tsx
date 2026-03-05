import { UIState, UIPanelSizes } from "@shared/model";
import { defaultUIState, UIStateManager } from "@shared/storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** How long to wait after the last UI state change before flushing to chrome.storage.sync. */
const SAVE_DEBOUNCE_MS = 500;

type UIStateContextValue = {
  uiState: UIState;
  updateUIState: (partial: Partial<UIState>) => void;
  updatePanelSizes: (partial: Partial<UIPanelSizes>) => void;
};

const UIStateContext = createContext<UIStateContextValue | null>(null);

/**
 * Provides persisted UI state (sidebar tab, selected script, panel sizes, drawer state)
 * to the entire options page. Loads from chrome.storage.sync before rendering children,
 * ensuring all defaultSize props see the correct values on first mount.
 */
export function UIStateProvider({ children }: { children: React.ReactNode }) {
  const [uiState, setUIState] = useState<UIState>(defaultUIState);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    UIStateManager.get().then((state) => {
      setUIState(state);
      setIsLoaded(true);
    });
  }, []);

  const scheduleSave = useCallback((state: UIState) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      UIStateManager.save(state);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateUIState = useCallback(
    (partial: Partial<UIState>) => {
      setUIState((prev) => {
        const next = { ...prev, ...partial };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const updatePanelSizes = useCallback(
    (partial: Partial<UIPanelSizes>) => {
      setUIState((prev) => {
        const next = { ...prev, panelSizes: { ...prev.panelSizes, ...partial } };
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
    <UIStateContext.Provider value={{ uiState, updateUIState, updatePanelSizes }}>
      {children}
    </UIStateContext.Provider>
  );
}

/**
 * Consumes the UI state context. Must be used within a {@link UIStateProvider}.
 */
export function useUIState(): UIStateContextValue {
  const context = useContext(UIStateContext);

  if (!context) {
    throw new Error("useUIState must be used within a UIStateProvider");
  }

  return context;
}
