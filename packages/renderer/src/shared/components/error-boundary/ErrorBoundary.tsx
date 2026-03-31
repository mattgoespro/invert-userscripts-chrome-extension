import { Component } from "react";
import { FallbackProps } from "react-error-boundary";
import { Typography } from "../typography/Typography";
import { Button } from "../button/Button";

export class ErrorBoundary extends Component<FallbackProps> {
  private getErrorName(): string {
    const { error } = this.props;

    if (error instanceof Error) {
      return error.name || "Error";
    }

    return "Unknown Error";
  }

  private getErrorMessage(): string {
    const { error } = this.props;

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return JSON.stringify(error, null, 2);
  }

  private getErrorStack(): string {
    const { error } = this.props;

    if (error instanceof Error && error.stack) {
      // Remove the first line (error name + message) from stack if present
      const stackLines = error.stack.split("\n");
      const filteredStack = stackLines
        .filter((line) => line.trim().startsWith("at "))
        .join("\n");
      return filteredStack || error.stack;
    }

    return null;
  }

  public render() {
    const errorName = this.getErrorName();
    const errorMessage = this.getErrorMessage();
    const errorStack = this.getErrorStack();

    return (
      <div className="absolute box-border flex h-full w-full flex-col items-center justify-center overflow-auto bg-linear-to-b from-error-surface-dark via-error-surface to-error-surface-dark p-8">
        <div className="flex w-full max-w-150 flex-col overflow-hidden rounded-2xl border border-error-border bg-error-surface">
          <div className="flex items-center gap-3.5 border-b border-error-border bg-[linear-gradient(135deg,var(--error-glow)_0%,transparent_60%)] px-7 py-6">
            <span className="h-10 w-10 rounded-[10px] border border-error-accent-soft bg-error-glow text-center text-lg leading-[1.8] shadow-[0_0_20px_var(--error-glow)]">
              ⚠️
            </span>
            <Typography variant="title">Something went wrong</Typography>
          </div>
          <div className="flex flex-col px-7 py-6">
            <div className="flex flex-col gap-2 border-b border-error-border py-4 first:pt-0 last:border-b-0 last:pb-0">
              <Typography variant="caption">Error</Typography>
              <div className="rounded-[10px] border border-error-border bg-error-surface-dark p-4 font-mono text-[13px] leading-8 wrap-break-word text-error-text-muted">
                <div className="mr-2 inline-flex self-start rounded-lg border border-error-accent-soft bg-error-glow px-1.5 font-mono text-xs text-error-accent">
                  {errorName}
                </div>
                <span>{errorMessage}</span>
              </div>
            </div>
            {errorStack && (
              <div className="flex flex-col gap-2 border-b border-error-border py-4 first:pt-0 last:border-b-0 last:pb-0">
                <Typography variant="caption">Stack Trace</Typography>
                <pre className="m-0 scrollbar-error max-h-50 overflow-x-auto overflow-y-auto rounded-[10px] border border-error-border bg-error-surface-dark p-4 font-mono text-[11px] leading-8 wrap-break-word whitespace-pre-wrap text-error-text-muted">
                  {errorStack}
                </pre>
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-error-border bg-error-surface-dark px-7 py-5">
            <Button onClick={this.props.resetErrorBoundary}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }
}
