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

  private getErrorStack(): string | null {
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
      <div className="from-error-surface-dark via-error-surface to-error-surface-dark absolute box-border flex h-full w-full flex-col items-center justify-center overflow-auto bg-linear-to-b p-8">
        <div className="bg-error-surface border-error-border flex w-full max-w-150 flex-col overflow-hidden rounded-2xl border">
          <div className="border-error-border flex items-center gap-3.5 border-b bg-[linear-gradient(135deg,var(--error-glow)_0%,transparent_60%)] px-7 py-6">
            <span className="bg-error-glow border-error-accent-soft h-10 w-10 rounded-[10px] border text-center text-lg leading-[1.8] shadow-[0_0_20px_var(--error-glow)]">
              ⚠️
            </span>
            <Typography variant="title">Something went wrong</Typography>
          </div>
          <div className="flex flex-col px-7 py-6">
            <div className="border-error-border flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
              <Typography variant="caption">Error</Typography>
              <div className="text-error-text-muted bg-error-surface-dark border-error-border rounded-[10px] border p-4 font-mono text-[13px] leading-8 wrap-break-word">
                <div className="text-error-accent bg-error-glow border-error-accent-soft mr-2 inline-flex self-start rounded-lg border px-1.5 font-mono text-xs">
                  {errorName}
                </div>
                <span>{errorMessage}</span>
              </div>
            </div>
            {errorStack && (
              <div className="border-error-border flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
                <Typography variant="caption">Stack Trace</Typography>
                <pre className="error-boundary__stack text-error-text-muted bg-error-surface-dark border-error-border m-0 max-h-50 overflow-x-auto overflow-y-auto rounded-[10px] border p-4 font-mono text-[11px] leading-8 wrap-break-word whitespace-pre-wrap">
                  {errorStack}
                </pre>
              </div>
            )}
          </div>
          <div className="bg-error-surface-dark border-error-border flex justify-end border-t px-7 py-5">
            <Button onClick={this.props.resetErrorBoundary}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }
}
