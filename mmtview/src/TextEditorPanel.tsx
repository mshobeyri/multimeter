import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";

interface TextEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const FIXED_BG_THEME = "fixed-bg-theme";

const defineTheme = (monaco: any) => {
  // Helper to get a CSS variable or fallback
  const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;

  monaco.editor.defineTheme(FIXED_BG_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      // Editor background and foreground
      "editor.background": cssVar('--vscode-editor-background', "#1e1e1e"),
      "editor.foreground": cssVar('--vscode-editor-foreground', "#d4d4d4"),

      // Line numbers
      "editorLineNumber.foreground": cssVar('--vscode-editorLineNumber-foreground', "#858585"),
      "editorLineNumber.activeForeground": cssVar('--vscode-editorLineNumber-activeForeground', "#c6c6c6"),

      // Cursor
      "editorCursor.foreground": cssVar('--vscode-editorCursor-foreground', "#aeafad"),

      // Selection & highlights
      "editor.selectionBackground": cssVar('--vscode-editor-selectionBackground', "#264f78"),
      "editor.inactiveSelectionBackground": cssVar('--vscode-editor-inactiveSelectionBackground', "#3a3d41"),
      "editor.selectionHighlightBackground": cssVar('--vscode-editor-selectionHighlightBackground', "#add6ff26"),
      "editor.wordHighlightBackground": cssVar('--vscode-editor-wordHighlightBackground', "#575757b8"),
      "editor.wordHighlightStrongBackground": cssVar('--vscode-editor-wordHighlightStrongBackground', "#004972b8"),
      "editor.findMatchBackground": cssVar('--vscode-editor-findMatchBackground', "#515c6a"),
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
      "editorOverviewRuler.border": cssVar('--vscode-editorOverviewRuler-border', "#282828"),
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

const TextEditorPanel: React.FC<TextEditorPanelProps> = ({ content, setContent }) => {
  const monacoRef = useRef<any>(null);

  // Define the theme BEFORE the editor mounts
  const handleBeforeMount = (monaco: any) => {
    monacoRef.current = monaco;
    defineTheme(monaco);
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

  return (
    <div style={{ height: "100%" }}>
      <MonacoEditor
        height="100%"
        width="100%"
        language="yaml"
        value={content}
        theme={FIXED_BG_THEME}
        beforeMount={handleBeforeMount}
        onChange={value => setContent(value ?? "")}
        options={{
          fontSize: 12,
          minimap: { enabled: false },
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
          lineNumbers: "on"
        }}
      />
    </div>
  );
};

export default TextEditorPanel;

