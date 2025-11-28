import monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import './CodeEditor.scss';

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const [_editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current != null && _editor == null) {
      const editorInstance = monaco.editor.create(editorRef.current, {
        value: value,
        language: 'typescript',
        automaticLayout: true,
        theme: 'vs-dark',
        minimap: { enabled: true },
      });

      editorInstance.getModel().onDidChangeContent(() => {
        const newValue = editorInstance.getModel().getValue();
        onChange(newValue);
      });

      setEditor(editorInstance);
    }

    return () => {
      _editor?.dispose();
    };
  }, [monaco, value]);

  useEffect(() => {
    if (_editor) {
      const model = _editor.getModel();
      const subscription = model.onDidChangeContent(() => {
        const newValue = model.getValue();
        onChange(newValue);
      });

      return () => {
        subscription.dispose();
      };
    }
  }, [_editor, onChange]);

  return <div style={{ height: '100%' }} ref={editorRef} className="editor"></div>;
}
