import React, { useEffect, useRef, useState } from "react";
import { parseYaml } from "../markupConvertor";
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
  const [editorReady, setEditorReady] = React.useState(false);

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

  // Highlight only the value part that starts with any prefix in highlightPrefixes:
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    let importPrefixes: string[] = [];
    try {
      const parsed = parseYaml(content);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.import &&
        Array.isArray(parsed.import)
      ) {
        // Get all keys from the import object
        interface ImportItem {
          [key: string]: any;
        }
        const keys: string[] = parsed.import
          .filter((item: ImportItem) => item && typeof item === "object" && !Array.isArray(item))
          .flatMap((item: ImportItem) => Object.keys(item));
        importPrefixes = Array.from(new Set([...keys]));
      } else {
        importPrefixes = [];
      }
    } catch (e) {
      importPrefixes = [];
    }

    // Always include these built-in prefixes
    const builtInPrefixes = ["i", "o", "e"];
    // Merge and deduplicate
    const allPrefixes = Array.from(new Set([...(importPrefixes || []), ...builtInPrefixes]));
    const prefixGroup = allPrefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|");
    const regex = new RegExp(
      `^(\\s*-?\\s*[^:#]+:\\s*)((${prefixGroup}):[^\\s#]*)`,
      "gm"
    );
    const matches: any[] = [];
    const value = model.getValue();
    let match;
    while ((match = regex.exec(value)) !== null) {
      const lineNumber = model.getPositionAt(match.index).lineNumber;
      const valueStartColumn = match[1].length + 1; // 1-based column
      const valueEndColumn = valueStartColumn + match[2].length;
      matches.push({
        range: new monaco.Range(lineNumber, valueStartColumn, lineNumber, valueEndColumn),
        options: { inlineClassName: I_PREFIX_CLASS }
      });
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, matches);
  }, [content, editorReady]);

  function setEditorErrorMarker(monaco: any, editor: any, error: { message: string, line: number, column: number, endColumn?: number }) {
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, "yaml", [
      {
        startLineNumber: error.line,
        startColumn: error.column,
        endLineNumber: error.line,
        endColumn: error.endColumn || error.column + 1,
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
    let error;
    try {
      parseYaml(content);
      // Clear markers if no error
      monaco.editor.setModelMarkers(editor.getModel(), "yaml", []);
    } catch (e: any) {
      // Example: e.message, e.mark.line, e.mark.column from js-yaml
      error = {
        message: e.message,
        line: (e.mark?.line ?? 0) + 1, // Monaco is 1-based
        column: (e.mark?.column ?? 0) + 1,
        endColumn: (e.mark?.column ?? 0) + 2,
      };
      setEditorErrorMarker(monaco, editor, error);
    }
  }, [content, editorReady]);

  return (
    <div style={{ height: "100%" }}>
      <TextEditor
        language={"yaml"}
        content={content}
        setContent={setContent}
        beforeMount={handleBeforeMount}
      />
    </div>
  );
};

export default YamlEditorPanel;