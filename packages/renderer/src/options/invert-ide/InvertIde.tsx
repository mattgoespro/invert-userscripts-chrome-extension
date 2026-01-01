import { useState } from "react";
import { Sidebar, SidebarButton } from "./sidebar/Sidebar";
import "./InvertIde.scss";
import { Scripts } from "./pages/scripts/Scripts";
import { Modules } from "./pages/modules/Modules";
import { ErrorBoundary } from "react-error-boundary";
import { Settings } from "./pages/settings/Settings";

export function InvertIde() {
  const [activeTab, setActiveTab] = useState<SidebarButton>("scripts");

  const onNavigate = (tab: SidebarButton) => {
    setActiveTab(tab);
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
            <Sidebar active={activeTab} onNavigate={onNavigate} />
          </div>
          <div className="invert-ide--dashboard-page-content">
            {activeTab === "scripts" && <Scripts />}
            {activeTab === "modules" && <Modules />}
            {activeTab === "settings" && <Settings />}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default InvertIde;
