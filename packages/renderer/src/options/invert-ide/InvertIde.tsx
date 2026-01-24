import "@/assets/styles/variables.scss";
import { useEffect, useState } from "react";
import "./InvertIde.scss";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { Sidebar, SidebarButton } from "./sidebar/Sidebar";
import { loadUserscripts } from "@/shared/store/slices/userscripts.slice";
import { useAppDispatch } from "@/shared/store/hooks";
import { registerCodeEditorThemes } from "@/shared/components/CodeEditorThemes";
import { SassCompiler } from "@/sandbox/compiler";

export function InvertIde() {
  const [active, setActive] = useState<SidebarButton>("scripts");
  const dispatch = useAppDispatch();

  useEffect(() => {
    registerCodeEditorThemes();

    // Initialize the SASS sandbox compiler early so it's ready when needed
    SassCompiler.initialize();

    dispatch(loadUserscripts());
  }, [dispatch]);

  const onNavigate = (button: SidebarButton) => {
    setActive(button);
  };

  return (
    <div className="invert-ide--dashboard">
      <div className="invert-ide--dashboard-header">
        <img src="assets/images/logo.png" alt="Invert IDE Logo" />
        <h1>⚡ Invert IDE Userscripts</h1>
        <div className="invert-ide--header-subtitle">
          Browser-based IDE for TypeScript userscripts
        </div>
      </div>
      <div className="invert-ide--dashboard-page">
        <Sidebar active={active} onNavigate={onNavigate} />
        <div className="invert-ide--dashboard-page-content">
          {active === "scripts" && <ScriptsPage />}
          {active === "modules" && <ModulesPage />}
          {active === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default InvertIde;
