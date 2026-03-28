import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { SassCompiler } from "@/sandbox/compiler";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco } from "@/shared/store/slices/monaco-editor/thunks.monaco-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { loadSettings } from "@/shared/store/slices/settings/thunks.settings";
import { loadUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { useEffect } from "react";
import { DashboardHeader } from "./components/dashboard-header/DashboardHeader";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";

/**
 * Root IDE shell. Renders the main layout with sidebar navigation and page content.
 * Expects {@link GlobalStateProvider} to be mounted by a parent component.
 */
export function InvertIde() {
  const { globalState, updateGlobalState } = useGlobalState();
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);

  useEffect(() => {
    // Initialize the SASS sandbox compiler early so it's ready when needed
    SassCompiler.initialize();

    // Initialize Monaco (registers Shiki tokenizer + defines all custom themes) unconditionally here so themes
    // are available regardless of which page is active on load.
    dispatch(initializeMonaco());

    dispatch(loadUserscripts());
    dispatch(loadSettings());
  }, [dispatch]);

  // Apply the persisted application UI theme to the document root whenever it changes.
  useEffect(() => {
    if (settings.appTheme) {
      applyAppTheme(settings.appTheme);
    }
  }, [settings.appTheme]);

  function applyAppTheme(themeId: string) {
    const root = document.documentElement;

    if (themeId === "graphite") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", themeId);
    }
  }

  function onNavigate(button: SidebarButton) {
    updateGlobalState({ activeSidebarTab: button });
  }

  return (
    <div className="bg-surface-base relative flex h-full flex-col overflow-hidden">
      <DashboardHeader />
      <div className="relative flex flex-1">
        <Sidebar
          active={globalState.activeSidebarTab}
          onNavigate={onNavigate}
        />
        <div className="*:animate-page-reveal relative flex flex-1">
          {globalState.activeSidebarTab === "scripts" && <ScriptsPage />}
          {globalState.activeSidebarTab === "modules" && <ModulesPage />}
          {globalState.activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}
