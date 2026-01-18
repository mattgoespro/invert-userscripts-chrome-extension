import { Component } from "react";
import { FallbackProps } from "react-error-boundary";
import { Typography } from "../typography/Typography";
import { Button } from "../button/Button";
import "./ErrorBoundary.scss";

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
      const filteredStack = stackLines.filter((line) => line.trim().startsWith("at ")).join("\n");
      return filteredStack || error.stack;
    }

    return null;
  }

  public render() {
    const errorName = this.getErrorName();
    const errorMessage = this.getErrorMessage();
    const errorStack = this.getErrorStack();

    return (
      <div className="error-boundary">
        <div className="error-boundary__content">
          <div className="error-boundary__header">
            <span className="error-boundary__icon">⚠️</span>
            <Typography variant="title">Something went wrong</Typography>
          </div>
          <div className="error-boundary__details">
            <div className="error-boundary__section">
              <Typography variant="caption">Error</Typography>
              <div className="error-boundary__message">
                <div className="error-boundary__name">{errorName}</div>
                <span>{errorMessage}</span>
              </div>
            </div>
            {errorStack && (
              <div className="error-boundary__section">
                <Typography variant="caption">Stack Trace</Typography>
                <pre className="error-boundary__stack">{errorStack}</pre>
              </div>
            )}
          </div>
          <div className="error-boundary__actions">
            <Button onClick={this.props.resetErrorBoundary}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }
}
