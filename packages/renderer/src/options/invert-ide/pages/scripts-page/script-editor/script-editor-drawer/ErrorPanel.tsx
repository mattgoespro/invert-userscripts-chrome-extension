import { useAppSelector } from "@/shared/store/hooks";
import { selectScriptErrors } from "@/shared/store/slices/workspace";
import { Typography } from "@/shared/components/typography/Typography";
import { CompilationError } from "@shared/errors";
import clsx from "clsx";

type ErrorPanelProps = {
  scriptId: string;
  onErrorClick?: (error: CompilationError) => void;
};

const FILE_NAMES: Record<CompilationError["language"], string> = {
  typescript: "main.ts",
  "type-definition": "types.d.ts",
  scss: "styles.scss",
};

export function ErrorPanel({ scriptId, onErrorClick }: ErrorPanelProps) {
  const errors = useAppSelector((state) => selectScriptErrors(state, scriptId));

  if (errors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base">
        <Typography variant="body">No problems in this script.</Typography>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin-6 h-full overflow-y-auto bg-surface-base">
      <div className="flex flex-col py-xs">
        {errors.map((error) => (
          <ErrorItem
            key={error.id}
            error={error}
            onClick={() => onErrorClick?.(error)}
          />
        ))}
      </div>
    </div>
  );
}

type ErrorItemProps = {
  error: CompilationError;
  onClick: () => void;
};

function ErrorItem({ error, onClick }: ErrorItemProps) {
  const isError = error.severity === "error";

  return (
    <button
      type="button"
      onClick={onClick}
      title="Go to this line"
      className="flex w-full cursor-pointer items-baseline gap-md px-md py-1.5 text-left transition-colors duration-150 hover:bg-hover-overlay focus-visible:bg-hover-overlay focus-visible:outline-none"
    >
      <span
        className={clsx(
          "w-14 shrink-0 text-xs font-semibold",
          isError ? "text-error-accent" : "text-warning"
        )}
      >
        {isError ? "Error" : "Warning"}
      </span>
      <span className="min-w-0 flex-1 text-base wrap-break-word text-foreground">
        {error.message}
        {error.code && (
          <span className="ml-2 text-xs text-text-muted-strong">
            {error.code}
          </span>
        )}
      </span>
      <span className="shrink-0 font-mono text-xs text-text-muted-strong">
        {FILE_NAMES[error.language]} {error.line}:{error.column}
      </span>
    </button>
  );
}
