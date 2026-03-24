import { CodeLine } from "@/shared/components/code-line/CodeLine";

export function DashboardHeader() {
  return (
    <header className="bg-surface-raised border-border relative border-b p-0">
      <div className="py-md px-lg relative flex items-center justify-start">
        <CodeLine code="export function InvertUserscripts (doc: Document): void {" />
      </div>
    </header>
  );
}
