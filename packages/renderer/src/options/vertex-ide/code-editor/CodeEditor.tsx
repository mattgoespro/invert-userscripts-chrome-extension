import { editor } from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

type CodeEditorProps = {
  language: string;
  code: string;
  onChange: (value: string) => void;
};

export function CodeEditor({ language, code, onChange }: CodeEditorProps) {
  const [_editor, setEditor] = useState<editor.IStandaloneCodeEditor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current == null) {
      return;
    }

    if (_editor == null) {
      const editorInstance = editor.create(editorRef.current, {
        value: code,
        language,
        model: editor.createModel(code, language),
        automaticLayout: true,
        theme: 'vs-dark',
        'semanticHighlighting.enabled': true,
        minimap: { enabled: true },
        allowOverflow: false,
      });

      editorInstance.getModel().onDidChangeContent(() => {
        const newValue = editorInstance.getModel().getValue();
        onChange(newValue);
      });

      setEditor(editorInstance);
    }
  }, [code, language]);

  return <div ref={editorRef} style={{ height: '100%' }}></div>;
}
