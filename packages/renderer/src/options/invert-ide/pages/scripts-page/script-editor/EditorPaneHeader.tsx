import clsx from "clsx";

type EditorPaneHeaderProps = {
  filename: string;
  description: string;
  dirty: boolean;
  problemCount: number;
  focused: boolean;
};

/** The tab-style label above each source editor pane. */
export function EditorPaneHeader({
  filename,
  description,
  dirty,
  problemCount,
  focused,
}: EditorPaneHeaderProps) {
  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-border-subtle bg-surface-panel select-none">
      <div
        className={clsx(
          "flex items-center gap-2 border-b-2 px-md",
          focused
            ? "border-b-accent bg-surface-base text-foreground"
            : "border-b-transparent text-text-muted"
        )}
        title={description}
      >
        <span className="font-mono text-xs">{filename}</span>
        {dirty && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            title="Unsaved changes"
          >
            <span className="sr-only">Unsaved changes</span>
          </span>
        )}
      </div>
      {problemCount > 0 && (
        <span className="ml-auto flex items-center pr-md text-[11px] text-error-accent">
          {problemCount} problem{problemCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
