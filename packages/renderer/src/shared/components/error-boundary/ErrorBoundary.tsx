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
      <div className="absolute w-full h-full bg-linear-to-b from-error-surface-dark via-error-surface to-error-surface-dark flex flex-col justify-center items-center p-8 box-border overflow-auto">
        <div className="max-w-150 w-full flex flex-col bg-error-surface border border-error-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3.5 py-6 px-7 bg-[linear-gradient(135deg,var(--error-glow)_0%,transparent_60%)] border-b border-error-border">
            <span className="w-10 h-10 bg-error-glow border border-error-accent-soft rounded-[10px] text-center leading-[1.8] text-lg shadow-[0_0_20px_var(--error-glow)]">
              ⚠️
            </span>
            <Typography variant="title">Something went wrong</Typography>
          </div>
          <div className="flex flex-col py-6 px-7">
            <div className="flex flex-col gap-2 py-4 border-b border-error-border first:pt-0 last:border-b-0 last:pb-0">
              <Typography variant="caption">Error</Typography>
              <div className="font-mono text-[13px] text-error-text-muted bg-error-surface-dark p-4 rounded-[10px] border border-error-border leading-8 wrap-break-word">
                <div className="inline-flex self-start font-mono text-xs text-error-accent bg-error-glow px-1.5 mr-2 rounded-lg border border-error-accent-soft">
                  {errorName}
                </div>
                <span>{errorMessage}</span>
              </div>
            </div>
            {errorStack && (
              <div className="flex flex-col gap-2 py-4 border-b border-error-border first:pt-0 last:border-b-0 last:pb-0">
                <Typography variant="caption">Stack Trace</Typography>
                <pre className="error-boundary__stack font-mono text-[11px] text-error-text-muted bg-error-surface-dark p-4 rounded-[10px] border border-error-border overflow-x-auto leading-8 m-0 whitespace-pre-wrap wrap-break-word max-h-50 overflow-y-auto">
                  {errorStack}
                </pre>
              </div>
            )}
          </div>
          <div className="flex justify-end py-5 px-7 bg-error-surface-dark border-t border-error-border">
            <Button onClick={this.props.resetErrorBoundary}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }
}
