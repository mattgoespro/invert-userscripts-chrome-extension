/**
 * Represents a TypeScript, declaration-file, or SCSS compilation error
 */
export interface CompilationError {
  /**
   * Unique identifier for this error
   */
  id: string;

  /**
   * Script ID this error belongs to
   */
  scriptId: string;

  /**
   * Source language that produced the error
   */
  language: "typescript" | "type-definition" | "scss";

  /**
   * Error message
   */
  message: string;

  /**
   * Error code (e.g., TS2304, SCSS1000)
   */
  code?: string;

  /**
   * Severity level
   */
  severity: "error" | "warning";

  /**
   * Line number (1-indexed)
   */
  line: number;

  /**
   * Column number (1-indexed)
   */
  column: number;

  /**
   * End line number (1-indexed)
   */
  endLine?: number;

  /**
   * End column number (1-indexed)
   */
  endColumn?: number;

  /**
   * Timestamp when error was detected
   */
  timestamp: number;
}
