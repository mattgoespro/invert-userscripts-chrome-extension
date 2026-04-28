import { CompilationError } from "@shared/errors";

type ScriptErrorMap = Partial<
  Record<CompilationError["language"], CompilationError[]>
>;

export interface WorkspaceState {
  /**
   * Errors by userscript ID
   */
  scriptErrors: Record<string, ScriptErrorMap>;
  /**
   * Currently visible userscript errors in the error panel.
   */
  visibleScriptId: string | null;
}

export const initialState: WorkspaceState = {
  scriptErrors: {},
  visibleScriptId: null,
};
