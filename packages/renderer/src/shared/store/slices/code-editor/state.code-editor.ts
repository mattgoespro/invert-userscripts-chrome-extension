export interface MonacoEditorState {
  monacoReady: boolean;
  ideReady: boolean;
  isSaving: boolean;
}

export const initialState: MonacoEditorState = {
  monacoReady: false,
  ideReady: false,
  isSaving: false,
};
