import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { ConflictDialog } from "@/options/invert-ide/components/conflict-dialog/ConflictDialog";
import { useStorageSync } from "@/options/invert-ide/hooks/useStorageSync";
import { SassCompiler } from "@/sandbox/compiler";
import { CommandPalette } from "@/shared/components/command-palette/CommandPalette";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  initializeMonaco,
  setIdeReady,
} from "@/shared/store/slices/code-editor/thunks.code-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { loadSettings } from "@/shared/store/slices/settings/thunks.settings";
import { loadModules } from "@/shared/store/slices/modules";
import {
  loadUserscripts,
  rebuildCompiledUserscripts,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { syncAllSharedScriptLibsFromUserscripts } from "@packages/monaco";
import { useCallback, useEffect, useState } from "react";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { useRegisterCoreCommands } from "./hooks/useRegisterCoreCommands";

export function InvertIde() {
  const { globalState, updateGlobalState } = useGlobalState();
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleOpenCommandPalette = useCallback(
    () => setCommandPaletteOpen(true),
    []
  );

  useRegisterCoreCommands({
    onOpenCommandPalette: handleOpenCommandPalette,
  });

  useStorageSync();

  useEffect(() => {
    SassCompiler.initialize();
    dispatch(initializeMonaco());

    void (async () => {
      try {
        const [scripts] = await Promise.all([
          dispatch(loadUserscripts()).unwrap(),
          dispatch(loadSettings()).unwrap(),
          dispatch(loadModules()).unwrap(),
        ] as const);

        syncAllSharedScriptLibsFromUserscripts(scripts);
        await dispatch(rebuildCompiledUserscripts({ scope: "stale" })).unwrap();
        dispatch(setIdeReady(true));
      } catch (error) {
        console.error("Failed to initialize IDE state:", error);
        dispatch(setIdeReady(true));
      }
    })();
  }, [dispatch]);

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
      <div className="relative flex min-w-0 flex-1">
        <Sidebar
          active={globalState.activeSidebarTab}
          onNavigate={onNavigate}
        />
        <div className="relative flex min-w-0 flex-1 *:animate-page-reveal">
          {globalState.activeSidebarTab === "scripts" && <ScriptsPage />}
          {globalState.activeSidebarTab === "modules" && <ModulesPage />}
          {globalState.activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <ConflictDialog />
    </div>
  );
}
