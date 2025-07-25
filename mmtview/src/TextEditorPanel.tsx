import React, { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { parseYaml } from "./markupConvertor";

interface TextEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number; // <-- Add this prop
}

const FIXED_BG_THEME = "fixed-bg-theme";

const defineTheme = (monaco: any) => {
  const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;

  monaco.editor.defineTheme(FIXED_BG_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      // YAML tokens
      { token: "key", foreground: "3ec9b1" },      // YAML keys
      { token: "string", foreground: "cf9178" },   // YAML strings
      { token: "number", foreground: "b6cea8" },   // YAML numbers
      { token: "type", foreground: "3ec9b1" },     // YAML types
      { token: "delimiter", foreground: "d4d4d4" },// YAML delimiters
      { token: "delimiter.yaml", foreground: "d4d4d4" },// YAML delimiters
      { token: "tag", foreground: "F07178" },      // YAML tags

      // JSON tokens
      { token: "string.key.json", foreground: "3ec9b1" },   // JSON keys
      { token: "string.value.json", foreground: "cf9178" }, // JSON string values
      { token: "number", foreground: "#F77669" },            // JSON numbers
      { token: "keyword.json", foreground: "d4d4d4" },      // JSON keywords (true, false, null)
      { token: "delimiter.json", foreground: "d4d4d4" },    // JSON delimiters

      // XML tokens
      { token: "tag.xml", foreground: "3ec9b1" },           // XML tags
      { token: "attribute.name.xml", foreground: "b6cea8" },// XML attribute names
      { token: "attribute.value.xml", foreground: "cf9178" },// XML attribute values
      { token: "string.xml", foreground: "cf9178" },        // XML string values
      { token: "comment.xml", foreground: "618b4f" },       // XML comments
      { token: "delimiter.xml", foreground: "d4d4d4" },  // XML string content

    ],
    colors: {
      // Editor background and foreground
      "editor.background": cssVar('--vscode-editor-background', "#1e1e1e"),
      // "editor.foreground":  "#cf9178",
      

      // Line numbers
      "editorLineNumber.foreground": cssVar('--vscode-editorLineNumber-foreground', "#858585"),
      "editorLineNumber.activeForeground": cssVar('--vscode-editorLineNumber-activeForeground', "#c6c6c6"),

      // Cursor
      "editorCursor.foreground": cssVar('--vscode-editorCursor-foreground', "#aeafad"),

      // Selection & highlights
      "editor.selectionBackground": cssVar('--vscode-editor-selectionBackground', "#264f78"),
      "editor.inactiveSelectionBackground": "#575757b8",
      "editor.selectionHighlightBackground": "#575757b8",
      "editor.wordHighlightBackground": "#575757b8",
      "editor.wordHighlightStrongBackground": "#575757b8",
      "editor.findMatchBackground": "#575757b8",
      "editor.findMatchHighlightBackground": cssVar('--vscode-editor-findMatchHighlightBackground', "#ea5c0055"),
      "editor.findRangeHighlightBackground": cssVar('--vscode-editor-findRangeHighlightBackground', "#3a3d4166"),

      // Bracket match
      "editorBracketMatch.background": cssVar('--vscode-editorBracketMatch-background', "#0064001a"),
      "editorBracketMatch.border": cssVar('--vscode-editorBracketMatch-border', "#888"),

      // Line highlight
      "editor.lineHighlightBackground": cssVar('--vscode-editor-lineHighlightBackground', "#2a2d2e"),
      "editor.lineHighlightBorder": cssVar('--vscode-editor-lineHighlightBorder', "#282828"),

      // Indent guides
      "editorIndentGuide.background": cssVar('--vscode-editorIndentGuide-background', "#404040"),
      "editorIndentGuide.activeBackground": cssVar('--vscode-editorIndentGuide-activeBackground', "#707070"),

      // Whitespace
      "editorWhitespace.foreground": cssVar('--vscode-editorWhitespace-foreground', "#e3e4e229"),

      // Gutter
      "editorGutter.background": cssVar('--vscode-editorGutter-background', "#232323"),
      "editorGutter.modifiedBackground": cssVar('--vscode-editorGutter-modifiedBackground', "#0c7d9d"),
      "editorGutter.addedBackground": cssVar('--vscode-editorGutter-addedBackground', "#587c0c"),
      "editorGutter.deletedBackground": cssVar('--vscode-editorGutter-deletedBackground', "#94151b"),

      // Widgets
      "editorWidget.background": cssVar('--vscode-editorWidget-background', "#232323"),
      "editorWidget.border": cssVar('--vscode-editorWidget-border', "#454545"),

      // Suggest widget
      "editorSuggestWidget.background": cssVar('--vscode-editorSuggestWidget-background', "#252526"),
      "editorSuggestWidget.border": cssVar('--vscode-editorSuggestWidget-border', "#454545"),
      "editorSuggestWidget.foreground": cssVar('--vscode-editorSuggestWidget-foreground', "#d4d4d4"),
      "editorSuggestWidget.selectedBackground": cssVar('--vscode-editorSuggestWidget-selectedBackground', "#2c2c2c"),

      // Hover widget
      "editorHoverWidget.background": cssVar('--vscode-editorHoverWidget-background', "#232323"),
      "editorHoverWidget.border": cssVar('--vscode-editorHoverWidget-border', "#454545"),

      // Markers
      "editorError.foreground": cssVar('--vscode-editorError-foreground', "#f48771"),
      "editorWarning.foreground": cssVar('--vscode-editorWarning-foreground', "#cca700"),
      "editorInfo.foreground": cssVar('--vscode-editorInfo-foreground', "#75beff"),

      // Diff editor
      "diffEditor.insertedTextBackground": cssVar('--vscode-diffEditor-insertedTextBackground', "#00809b33"),
      "diffEditor.removedTextBackground": cssVar('--vscode-diffEditor-removedTextBackground', "#a3151533"),

      // Overview ruler
      // "editorOverviewRuler.border": cssVar('--vscode-editorOverviewRuler-border', "#282828"),
      "editorOverviewRuler.errorForeground": cssVar('--vscode-editorError-foreground', "#f48771"),
      "editorOverviewRuler.warningForeground": cssVar('--vscode-editorWarning-foreground', "#cca700"),
      "editorOverviewRuler.infoForeground": cssVar('--vscode-editorInfo-foreground', "#75beff"),

      // Minimap
      "minimap.background": cssVar('--vscode-editor-background', "#1e1e1e"),
      "minimap.selectionHighlight": cssVar('--vscode-editor-selectionBackground', "#264f78"),
      "minimap.errorHighlight": cssVar('--vscode-editorError-foreground', "#f48771"),
      "minimap.warningHighlight": cssVar('--vscode-editorWarning-foreground', "#cca700"),
      "minimap.infoHighlight": cssVar('--vscode-editorInfo-foreground', "#75beff"),
    },
  });
};

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";

const TextEditorPanel: React.FC<TextEditorPanelProps> = ({
  content,
  setContent,
  language = "yaml",
  showNumbers = true,
  fontSize = 12, // <-- Default font size
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const [editorReady, setEditorReady] = React.useState(false);

  // Register autocomplete provider before mount
  const handleBeforeMount = (monaco: any) => {
    monacoRef.current = monaco;
    defineTheme(monaco);

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
        { label: "url", kind: monaco.languages.CompletionItemKind.Property, insertText: "url: " },
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

  // Listen for VS Code theme changes and update Monaco theme
  useEffect(() => {
    const handler = () => {
      if (monacoRef.current) {
        defineTheme(monacoRef.current);
        monacoRef.current.editor.setTheme(FIXED_BG_THEME);
      }
    };
    window.addEventListener("vscode:changeColorTheme", handler);
    return () => window.removeEventListener("vscode:changeColorTheme", handler);
  }, []);

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

  // Add CSS for the decoration
  useEffect(() => {
    if (document.getElementById("i-prefix-highlight-style")) return;
    const style = document.createElement("style");
    style.id = "i-prefix-highlight-style";
    style.innerHTML = `
      .${I_PREFIX_CLASS} {
        background:rgba(150, 246, 255, 0.27);
        color:rgb(203, 203, 203) !important;
        border-radius: 2px;
        padding: 0 2px;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add this in your main React entry file (e.g. index.tsx or App.tsx)
  useEffect(() => {
    window.addEventListener("message", event => {
      if (event.data && event.data.type === "vscode:changeColorTheme") {
        window.dispatchEvent(new Event("vscode:changeColorTheme"));
      }
    });
  }, []);

  return (
    <div style={{ height: "100%" }}>
      <MonacoEditor
        height="100%"
        width="100%"
        language={language}
        value={content}
        theme={FIXED_BG_THEME}
        beforeMount={handleBeforeMount}
        onMount={editor => {
          editorRef.current = editor;
          setEditorReady(e => !e);
        }}
        onChange={value => setContent(value ?? "")}
        options={{
          fontSize,
          minimap: { enabled: false },
          wordWrap: "on",
          scrollBeyondLastLine: false,
          tabSize: 2,
          automaticLayout: true,
          lineNumbers: showNumbers ? "on" : "off",
          scrollbar: {
            horizontal: "auto",
            vertical: "auto"
          }
        }}
      />
    </div>
  );
};

export default TextEditorPanel;