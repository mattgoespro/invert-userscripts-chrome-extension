import { CodeLine } from "@/shared/components/code-line/CodeLine";
import "./DashboardHeader.scss";

export function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header--glow" aria-hidden="true" />
      <div className="dashboard-header--grid-pattern" aria-hidden="true" />
      <div className="dashboard-header--content">
        <CodeLine code="export function InvertUserscripts (doc: Document): void {" />
      </div>
    </header>
  );
}
