import { SassCompiler } from "@/sandbox/compiler";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import {
  GlobalStateProvider,
  useGlobalState,
} from "@/options/invert-ide/contexts/global-state.context";
import { useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header/DashboardHeader";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { loadUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { loadSettings } from "@/shared/store/slices/settings/thunks.settings";
import { initializeMonaco } from "@/shared/store/slices/monaco-editor/thunks.monaco-editor";

function applyAppTheme(themeId: string) {
  const root = document.documentElement;

  if (themeId === "graphite") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }
}

/**
 * Root IDE shell. Mounts the {@link GlobalStateProvider} so that all child components
 * have access to persisted UI state before they first render.
 */
export function InvertIde() {
  return (
    <GlobalStateProvider>
      <InvertIdeContent />
    </GlobalStateProvider>
  );
}

function InvertIdeContent() {
  const { globalState, updateGlobalState } = useGlobalState();
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
    updateGlobalState({ activeSidebarTab: button });
  };

  return (
    <div className="flex flex-col h-full bg-surface-base relative overflow-hidden">
      <DashboardHeader />
      <div className="flex flex-1 relative">
        <Sidebar
          active={globalState.activeSidebarTab}
          onNavigate={onNavigate}
        />
        <div className="flex-1 flex relative *:animate-page-reveal">
          {globalState.activeSidebarTab === "scripts" && <ScriptsPage />}
          {globalState.activeSidebarTab === "modules" && <ModulesPage />}
          {globalState.activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default InvertIde;
