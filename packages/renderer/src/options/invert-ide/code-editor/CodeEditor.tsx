import { editor, KeyCode, KeyMod } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { registerCodeEditorThemes } from "../../../shared/components/CodeEditorThemes";

type CodeEditorProps = {
  language: string;
  contents: string;
  onCodeModified: (value: string) => void;
  onCodeSaved: (value: string) => void;
};

export function CodeEditor({ language, contents, onCodeModified, onCodeSaved }: CodeEditorProps) {
  registerCodeEditorThemes();

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    language,
    model: editor.createModel(contents, language),
    value: contents,

    // Layout options
    automaticLayout: true,
    padding: { top: 25, bottom: 10 },
    fixedOverflowWidgets: true, // prevent widgets (such as the hover quick-fix widget) from being cut off when near the editor edge
    allowOverflow: false,

    // Interface options
    theme: "Dark",
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
      const editorInstance = editor.create(editorRef.current, editorOptions);

      editorInstance.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => {
        onCodeSaved(editorInstance.getValue());
      });

      editorInstance.onDidChangeModelContent(() => {
        onCodeModified(editorInstance.getValue());
      });

      setEditor(editorInstance);
    }
  }, [contents, language]);

  return (
    <div
      ref={editorRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    ></div>
  );
}
