export interface MonacoEditorState {
  monacoReady: boolean;
  isSaving: boolean;
}

export const initialState: MonacoEditorState = {
  monacoReady: false,
  isSaving: false,
};
