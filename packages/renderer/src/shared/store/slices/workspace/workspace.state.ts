import { CompilationError } from "@shared/errors";

export interface WorkspaceState {
  /**
   * Errors by userscript ID
   */
  scriptErrors: Record<string, CompilationError[]>;
  /**
   * Currently visible userscript errors in the error panel.
   */
  visibleScriptId: string | null;
}

export const initialState: WorkspaceState = {
  scriptErrors: {},
  visibleScriptId: null,
};
