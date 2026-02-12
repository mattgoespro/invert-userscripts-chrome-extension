import { SassCompiler } from "@/sandbox/compiler";
import { registerCodeEditorThemes } from "@/shared/components/model";
import { ThemeSwitcher } from "@/shared/components/theme-switcher/ThemeSwitcher";
import { useAppDispatch } from "@/shared/store/hooks";
import { loadUserscripts } from "@/shared/store/slices/userscripts.slice";
import { useEffect, useState } from "react";
import "./InvertIde.scss";
import { DashboardHeader } from "./components/dashboard-header/DashboardHeader";
import { Sidebar, SidebarButton } from "./components/sidebar/Sidebar";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";

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
      <DashboardHeader />
      <div className="invert-ide--dashboard-page">
        <Sidebar active={active} onNavigate={onNavigate} />
        <div className="invert-ide--dashboard-page-content">
          {active === "scripts" && <ScriptsPage />}
          {active === "modules" && <ModulesPage />}
          {active === "settings" && <Settings />}
        </div>
      </div>
      <ThemeSwitcher />
    </div>
  );
}

export default InvertIde;
