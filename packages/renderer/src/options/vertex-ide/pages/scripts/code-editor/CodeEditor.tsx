import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import { useEffect, useRef, useState } from 'react';

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    switch (label) {
      case 'typescript':
      case 'javascript':
        return './monaco/ts.worker.js';
      case 'css':
      case 'scss':
        return './monaco/css.worker.js';
    }

    return './monaco/editor.worker.js';
  },
};

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

  return <div ref={editorRef} style={{ height: '100%' }}></div>;
}
