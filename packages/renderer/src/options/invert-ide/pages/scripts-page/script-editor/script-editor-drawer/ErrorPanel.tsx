import { useAppSelector } from "@/shared/store/hooks";
import { selectScriptErrors } from "@/shared/store/slices/workspace";
import { Typography } from "@/shared/components/typography/Typography";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { CompilationError } from "@shared/errors";
import clsx from "clsx";

type ErrorPanelProps = {
  scriptId: string;
  onErrorClick?: (error: CompilationError) => void;
};

export function ErrorPanel({ scriptId, onErrorClick }: ErrorPanelProps) {
  const errors = useAppSelector((state) => selectScriptErrors(state, scriptId));

  if (errors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base">
        <Typography variant="body" className="text-text-muted">
          No errors or warnings
        </Typography>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin-6 h-full overflow-y-auto bg-surface-base">
      <div className="flex flex-col gap-2xs p-md">
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
  const languageLabel =
    error.language === "typescript"
      ? "TS"
      : error.language === "type-definition"
        ? "DTS"
        : "SCSS";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full cursor-pointer items-start gap-sm rounded-default border p-sm text-left transition-colors duration-150",
        isError
          ? "border-error-border bg-error-surface hover:bg-error-surface-dark"
          : "border-border bg-surface-raised hover:bg-hover-overlay"
      )}
    >
      <div className="shrink-0 pt-[2px]">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-error-accent" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2xs">
        <div className="flex items-baseline gap-sm">
          <Typography variant="caption" className="font-mono text-text-muted">
            {languageLabel}
          </Typography>
          <Typography
            variant="caption"
            className="font-mono text-text-muted-faint"
          >
            Line {error.line}:{error.column}
          </Typography>
          {error.code && (
            <Typography
              variant="caption"
              className="font-mono text-text-muted-faint"
            >
              [{error.code}]
            </Typography>
          )}
        </div>
        <Typography
          variant="body"
          className={clsx(
            "wrap-break-word",
            isError ? "text-error-text-muted" : "text-text-muted-strong"
          )}
        >
          {error.message}
        </Typography>
      </div>
    </button>
  );
}
