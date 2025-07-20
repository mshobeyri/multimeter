import React, { useEffect, useRef, useState } from "react";
import { parseYamlDoc } from "../markupConvertor";
import TextEditor from "../text/TextEditor";

interface YamlEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number; // <-- Add this prop
}

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";

const YamlEditorPanel: React.FC<YamlEditorPanelProps> = ({
  content,
  setContent
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const [editorReady, setEditorReady] = useState(false);

  // Register autocomplete provider before mount
  const handleBeforeMount = (monaco: any) => {
    const keySuggestionsByParent: Record<string, any[]> = {
      root: [
        {
          label: "type",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "type:",
        },

        {
          label: "tags",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "tags:",
        },
        {
          label: "description",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "description:",
        },
        {
          label: "import",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "import:",
        },
        {
          label: "inputs",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "inputs:",
        },
        {
          label: "outputs",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "outputs:",
        },
        {
          label: "interfaces",
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: "interfaces:",
        },
      ],
      interfaces: [
        { label: "name", kind: monaco.languages.CompletionItemKind.Property, insertText: "- name: " },
        { label: "protocol", kind: monaco.languages.CompletionItemKind.Property, insertText: "protocol: " },
        { label: "format", kind: monaco.languages.CompletionItemKind.Property, insertText: "format: " },
        { label: "endpoint", kind: monaco.languages.CompletionItemKind.Property, insertText: "endpoint: " },
        { label: "body", kind: monaco.languages.CompletionItemKind.Property, insertText: "body: " },
      ],
    };

    monaco.languages.registerCompletionItemProvider("yaml", {
      provideCompletionItems: (model: any, position: any) => {
        const lineNumber = position.lineNumber;
        const lines = model.getLinesContent().slice(0, lineNumber - 1);
        let parent = "root";
        // Find the nearest non-empty, less-indented line above
        const currentIndent = model.getLineContent(lineNumber).search(/\S|$/);
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (!line.trim()) continue;
          const indent = line.search(/\S|$/);
          if (indent < currentIndent) {
            const match = line.trim().match(/^(\w+):/);
            if (match) {
              parent = match[1];
            }
            break;
          }
        }
        const suggestions = keySuggestionsByParent[parent] || keySuggestionsByParent.root;
        return { suggestions };
      },

      triggerCharacters: ["\n", " "], // Trigger on new line or space
    });
  };

  function setEditorErrorMarker(monaco: any, editor: any, error: { message: string, line?: number, column?: number, endColumn?: number }) {
    const model = editor.getModel();
    if (!model) return;

    // If line/column is missing, mark the whole first line
    const line = error.line && error.line > 0 ? error.line : 1;
    const column = error.column && error.column > 0 ? error.column : 1;
    const endColumn =
      error.endColumn && error.endColumn > column
        ? error.endColumn
        : model.getLineMaxColumn(line);

    monaco.editor.setModelMarkers(model, "yaml", [
      {
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: endColumn,
        message: error.message,
        severity: monaco.MarkerSeverity.Error,
      }
    ]);
  }

  // Validate YAML and set error marker if invalid
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    try {
      const errors = parseYamlDoc(content);
      if (errors && errors.length > 0) {
        const error = errors[0];
        // Use linePos array for start/end
        const start = error.linePos?.[0];
        const end = error.linePos?.[1];
        setEditorErrorMarker(monaco, editor, {
          message: error.message,
          line: start ? start.line : 0,
          column: start ? start.col : 0,
          endColumn: end ? end.col + 1 : (start ? start.col + 2 : 2)
        });
      } else {
        monaco.editor.setModelMarkers(model, "yaml", []);
      }
    } catch (e: any) {
    }
  }, [content, editorReady]);

  // Effect to handle custom decorations
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const regex = /[ieo]:[a-zA-Z0-9_\/-]+/g;
    const value = model.getValue();
    const matches: any[] = [];
    let match;
    while ((match = regex.exec(value)) !== null) {
      const start = model.getPositionAt(match.index);
      const end = model.getPositionAt(match.index + match[0].length);
      matches.push({
        range: new monaco.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column
        ),
        options: { inlineClassName: I_PREFIX_CLASS }
      });
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      matches
    );
  }, [content, editorReady]);

  return (
    <div style={{ height: "100%" }}>
      <TextEditor
        language={"yaml"}
        content={content}
        setContent={setContent}
        beforeMount={handleBeforeMount}
        editorRef={editorRef}
        monacoRef={monacoRef}
        setEditorReady={setEditorReady}
      />
    </div>
  );
};

export default YamlEditorPanel;