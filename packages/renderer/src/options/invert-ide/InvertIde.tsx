import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { SassCompiler } from "@/sandbox/compiler";
import { CommandPalette } from "@/shared/components/command-palette/CommandPalette";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco } from "@/shared/store/slices/code-editor/thunks.code-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { loadSettings } from "@/shared/store/slices/settings/thunks.settings";
import {
  loadUserscripts,
  rebuildCompiledUserscripts,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { useCallback, useEffect, useState } from "react";
import { DashboardHeader } from "./components/dashboard-header/DashboardHeader";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { useRegisterCoreCommands } from "./hooks/useRegisterCoreCommands";

/**
 * Root IDE shell. Renders the main layout with sidebar navigation and page content.
 * Expects {@link GlobalStateProvider} to be mounted by a parent component.
 */
export function InvertIde() {
  const { globalState, updateGlobalState } = useGlobalState();
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Memoized to prevent re-render loops: this is fed into useRegisterCoreCommands
  // which places it in a useMemo dep array. An inline arrow would create a new
  // reference on every render, re-triggering command registration → infinite loop.
  const handleOpenCommandPalette = useCallback(
    () => setCommandPaletteOpen(true),
    []
  );

  // Register core IDE commands
  useRegisterCoreCommands({
    onOpenCommandPalette: handleOpenCommandPalette,
  });

  useEffect(() => {
    // Initialize the SASS sandbox compiler early so it's ready when needed
    SassCompiler.initialize();

    // Initialize Monaco (registers Shiki tokenizer + defines all custom themes) unconditionally here so themes
    // are available regardless of which page is active on load.
    dispatch(initializeMonaco());

    void (async () => {
      try {
        await Promise.all([
          dispatch(loadUserscripts()).unwrap(),
          dispatch(loadSettings()).unwrap(),
        ]);

        await dispatch(rebuildCompiledUserscripts({ scope: "stale" })).unwrap();
      } catch (error) {
        console.error("Failed to initialize IDE state:", error);
      }
    })();
  }, [dispatch]);

  // Global keyboard handler for Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, []);

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
    <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
      <DashboardHeader />
      <div className="relative flex flex-1">
        <Sidebar
          active={globalState.activeSidebarTab}
          onNavigate={onNavigate}
        />
        <div className="relative flex flex-1 *:animate-page-reveal">
          {globalState.activeSidebarTab === "scripts" && <ScriptsPage />}
          {globalState.activeSidebarTab === "modules" && <ModulesPage />}
          {globalState.activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
