import { startIdeWorkspace } from "@/shared/services/ide-workspace-lifetime";
import { LanguageAcquisitionNotice } from "./components/LanguageAcquisitionNotice";
import { RuntimeCapabilityNotice } from "@/shared/components/runtime-capability/RuntimeCapabilityNotice";
import { ConflictDialog } from "@/options/invert-ide/components/conflict-dialog/ConflictDialog";
import { useStorageSync } from "@/options/invert-ide/hooks/useStorageSync";
import { SassCompiler, initializeBuildWorker } from "@/sandbox/compiler";
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
import {
  selectActiveSidebarTab,
  setActiveSidebarTab,
} from "@/shared/store/slices/ui";
import { startWorkspaceService } from "@/shared/services/workspace-service";
import { store } from "@/shared/store/store";
import {
  restoreDraftRecovery,
  startDraftRecovery,
} from "@/shared/services/draft-recovery-service";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import type { AppSidebarTab } from "@shared/storage";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { useRegisterCoreCommands } from "./hooks/useRegisterCoreCommands";

export function InvertIde() {
  const dispatch = useAppDispatch();
  const activeSidebarTab = useAppSelector(selectActiveSidebarTab);
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
    initializeBuildWorker();

    return startIdeWorkspace({
      initialize: async () => {
        // Monaco/Shiki must finish before readiness mounts the editors.
        await Promise.all([
          dispatch(initializeMonaco()).unwrap(),
          dispatch(loadUserscripts()).unwrap(),
          dispatch(loadSettings()).unwrap(),
          dispatch(loadModules()).unwrap(),
        ]);
        await restoreDraftRecovery(store);
      },
      attachWorkspace: () => {
        const stopWorkspace = startWorkspaceService(store);
        const stopRecovery = startDraftRecovery(store);
        return () => {
          stopRecovery();
          stopWorkspace();
        };
      },
      rebuildStaleArtifacts: async () => {
        await dispatch(rebuildCompiledUserscripts({ scope: "stale" })).unwrap();
      },
      markReady: () => {
        dispatch(setIdeReady(true));
      },
      reportError: (error) =>
        console.error("Failed to initialize IDE state:", error),
    });
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

  function onNavigate(button: AppSidebarTab) {
    dispatch(setActiveSidebarTab(button));
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
      <RuntimeCapabilityNotice />
      <LanguageAcquisitionNotice />
      <div className="relative flex min-w-0 flex-1">
        <Sidebar active={activeSidebarTab} onNavigate={onNavigate} />
        <div className="relative flex min-w-0 flex-1 *:animate-page-reveal">
          {activeSidebarTab === "scripts" && <ScriptsPage />}
          {activeSidebarTab === "modules" && <ModulesPage />}
          {activeSidebarTab === "settings" && <Settings />}
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
