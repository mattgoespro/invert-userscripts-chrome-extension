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
import { StatusBar } from "./components/status-bar/StatusBar";
import type { AppSidebarTab } from "@shared/storage";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { useRegisterCoreCommands } from "./hooks/useRegisterCoreCommands";
import { applyAppTheme } from "@/shared/utils/app-theme";
import { NEW_SCRIPT_PATTERN_PARAM } from "@shared/constants";
import type { AppDispatch } from "@/shared/store/store";
import { selectUserscript } from "@/shared/store/select-userscript";
import {
  createUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { isValidUrlPattern } from "./pages/scripts-page/script-editor/script-metadata/url-patterns";

/** Handles the popup's "New script for <site>" hand-off via the page URL. */
async function createScriptFromLaunchParams(
  dispatch: AppDispatch
): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const pattern = params.get(NEW_SCRIPT_PATTERN_PARAM);
  if (!pattern) {
    return;
  }

  params.delete(NEW_SCRIPT_PATTERN_PARAM);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (query ? `?${query}` : "")
  );

  if (!isValidUrlPattern(pattern)) {
    return;
  }

  const script = await dispatch(createUserscript()).unwrap();
  const host = new URL(pattern.replace("*://", "https://")).hostname;
  await dispatch(
    updateUserscript({
      id: script.id,
      updates: { name: `${host} script`, urlPatterns: [pattern] },
    })
  ).unwrap();
  dispatch(selectUserscript(script.id));
  dispatch(setActiveSidebarTab("scripts"));
}

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
        void createScriptFromLaunchParams(dispatch).catch((error) =>
          console.error("Failed to create script for site:", error)
        );
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
    applyAppTheme(settings.appTheme);
  }, [settings.appTheme]);

  function onNavigate(button: AppSidebarTab) {
    dispatch(setActiveSidebarTab(button));
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
      <RuntimeCapabilityNotice />
      <LanguageAcquisitionNotice />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <Sidebar
          active={activeSidebarTab}
          onNavigate={onNavigate}
          onOpenCommandPalette={handleOpenCommandPalette}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 *:animate-page-reveal">
          {activeSidebarTab === "scripts" && <ScriptsPage />}
          {activeSidebarTab === "modules" && <ModulesPage />}
          {activeSidebarTab === "settings" && <Settings />}
        </div>
      </div>
      <StatusBar />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <ConflictDialog />
    </div>
  );
}
