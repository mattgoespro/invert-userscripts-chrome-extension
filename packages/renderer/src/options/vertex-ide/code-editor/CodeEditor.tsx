import monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import './CodeEditor.scss';

type CodeEditorProps = {
  value: string;
};

export function CodeEditor(props: CodeEditorProps) {
  const [_editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && _editor == null) {
      setEditor(
        monaco.editor.create(editorRef.current, {
          value: props.value,
          language: 'typescript',
          automaticLayout: true,
          theme: 'vs-dark',
          minimap: { enabled: true },
        })
      );
    }

    if (props.value) {
      const model = monaco.editor.createModel(props.value, 'typescript');
      _editor?.setModel(model);
    }

    return () => {
      _editor?.dispose();
    };
  }, [monaco, props.value]);

  return <div style={{ height: '100%' }} ref={editorRef} className="editor"></div>;
}
