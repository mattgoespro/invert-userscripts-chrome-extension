import { editor, KeyCode, KeyMod } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

type CodeEditorProps = {
  language: string;
  contents: string;
  onModify: () => void;
  onSave: (value: string) => void;
};

export function CodeEditor({ language, contents, onModify, onSave }: CodeEditorProps) {
  const [_editor, setEditor] = useState<editor.IStandaloneCodeEditor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current == null) {
      return;
    }

    if (_editor == null) {
      const editorInstance = editor.create(editorRef.current, {
        // Language options
        language,
        model: editor.createModel(contents, language),
        value: contents,
        // Interface options
        theme: "vs-dark",
        fontSize: 14,
        automaticLayout: true,
        allowOverflow: false,
        fixedOverflowWidgets: true, // keep widgets (such as the hover quick-fix widget) inside editor bounds
        padding: { top: 25, bottom: 10 },
        wordWrap: "on",
        minimap: { enabled: true },
      });

      editorInstance.onDidChangeModelContent(() => {
        onModify();
      });

      editorInstance.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => {
        onSave(editorInstance.getValue());
      });

      setEditor(editorInstance);
    }
  }, [contents, language]);

  return <div ref={editorRef} style={{ height: "100%" }}></div>;
}
