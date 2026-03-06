import { SassCompiler } from "@/sandbox/compiler";
import { DevTools } from "../../shared/components/devtools/DevTools";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco } from "@/shared/store/slices/editor.slice";
import { loadSettings, selectEditorSettings } from "@/shared/store/slices/settings.slice";
import { loadUserscripts } from "@/shared/store/slices/userscripts.slice";
import { UIStateProvider, useUIState } from "@/shared/ui-state-context";
import { useEffect } from "react";
import "./InvertIde.scss";
import { DashboardHeader } from "./components/dashboard-header/DashboardHeader";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";

function applyAppTheme(themeId: string) {
  const root = document.documentElement;

  if (themeId === "graphite") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }
}

/**
 * Root IDE shell. Mounts the {@link UIStateProvider} so that all child components
 * have access to persisted UI state before they first render.
 */
export function InvertIde() {
  return (
    <UIStateProvider>
      <InvertIdeContent />
    </UIStateProvider>
  );
}

function InvertIdeContent() {
  const { uiState, updateUIState } = useUIState();
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);

  useEffect(() => {
    // Initialize the SASS sandbox compiler early so it's ready when needed
    SassCompiler.initialize();

    /**
     * Initialize Monaco (registers Shiki tokenizer + defines all custom themes) unconditionally here so themes
     * are available regardless of which page is active on load.
     */
    dispatch(initializeMonaco());

    dispatch(loadUserscripts());
    dispatch(loadSettings());
  }, [dispatch]);

  /** Apply the persisted application UI theme to the document root whenever it changes. */
  useEffect(() => {
    if (settings.appTheme) {
      applyAppTheme(settings.appTheme);
    }
  }, [settings.appTheme]);

  const onNavigate = (button: SidebarButton) => {
    updateUIState({ activeSidebarTab: button });
  };

  return (
    <div className="invert-ide--dashboard">
      <DashboardHeader />
      <div className="invert-ide--dashboard-page">
        <Sidebar active={uiState.activeSidebarTab} onNavigate={onNavigate} />
        <div className="invert-ide--dashboard-page-content">
          {uiState.activeSidebarTab === "scripts" && <ScriptsPage />}
          {uiState.activeSidebarTab === "modules" && <ModulesPage />}
          {uiState.activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
      <DevTools />
    </div>
  );
}

export default InvertIde;
