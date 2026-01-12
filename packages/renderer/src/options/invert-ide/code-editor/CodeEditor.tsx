import { editor, KeyCode, KeyMod } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { registerCodeEditorThemes } from "./themes/CodeEditorThemes";

type CodeEditorProps = {
  language: string;
  contents: string;
  onSave: (value: string) => void;
};

export function CodeEditor({ language, contents, onSave }: CodeEditorProps) {
  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    language,
    model: editor.createModel(contents, language),
    value: contents,

    // Layout options
    automaticLayout: true,
    padding: { top: 25, bottom: 10 },
    fixedOverflowWidgets: true, // keep widgets (such as the hover quick-fix widget) inside editor bounds
    allowOverflow: false,

    // Interface options
    theme: "invert-ide-dark",
    fontSize: 14,
    scrollbar: {
      verticalSliderSize: 6,
      verticalScrollbarSize: 6,
      verticalHasArrows: true,
    },
    wordWrap: "on",
    minimap: { enabled: false },
  };

  const [_editor, setEditor] = useState<editor.IStandaloneCodeEditor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current == null) {
      return;
    }

    if (_editor == null) {
      registerCodeEditorThemes();

      const editorInstance = editor.create(editorRef.current, editorOptions);

      editorInstance.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => {
        const newValue = editorInstance.getValue();
        onSave(newValue);
      });

      setEditor(editorInstance);
    }
  }, [contents, language]);

  return (
    <div
      className="editor-container-ref"
      ref={editorRef}
      style={{
        height: "100%",
      }}
    ></div>
  );
}
