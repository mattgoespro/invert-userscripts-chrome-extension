import "@/assets/styles/variables.scss";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import "./InvertIde.scss";
import { ModulesPage } from "./pages/modules-page/ModulesPage";
import { ScriptsPage } from "./pages/scripts-page/ScriptsPage";
import { Settings } from "./pages/settings-page/SettingsPage";
import { Sidebar, SidebarButton } from "./sidebar/Sidebar";
import { loadUserscripts } from "@/shared/store/slices/userscripts.slice";
import { useAppDispatch } from "@/shared/store/hooks";

export function InvertIde() {
  const [active, setActive] = useState<SidebarButton>("scripts");
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadUserscripts());
  });

  const onNavigate = (button: SidebarButton) => {
    setActive(button);
  };

  return (
    <ErrorBoundary fallback={<span>Something went wrong.</span>}>
      <div className="invert-ide--dashboard">
        <div className="invert-ide--dashboard-header">
          <h1>⚡ Invert IDE Userscripts</h1>
          <div className="invert-ide--header-subtitle">
            Browser-based IDE for TypeScript userscripts
          </div>
        </div>
        <div className="invert-ide--dashboard-page">
          <div className="invert-ide--sidebar-wrapper">
            <Sidebar active={active} onNavigate={onNavigate} />
          </div>
          <div className="invert-ide--dashboard-page-content">
            {active === "scripts" && <ScriptsPage />}
            {active === "modules" && <ModulesPage />}
            {active === "settings" && <Settings />}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default InvertIde;
