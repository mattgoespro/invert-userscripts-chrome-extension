import { CodeLine } from "@/shared/components/code-line/CodeLine";

export function DashboardHeader() {
  return (
    <header className="relative bg-surface-raised border-b border-border p-0">
      <div className="relative flex items-center justify-start py-md px-lg">
        <CodeLine code="export function InvertUserscripts (doc: Document): void {" />
      </div>
    </header>
  );
}
