import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import { FIXED_BG_THEME, defineTheme } from "./Theme";

interface TextEditorProps {
  content: string;
  setContent: (value: string) => void;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number;
  beforeMount?: (monaco: any) => void;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  setEditorReady?: (ready: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
  onToggleRunButton?: () => void;
  showGlyphMargin?: boolean;
}

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";

const TextEditor: React.FC<TextEditorProps> = ({
  content,
  setContent,
  language = "yaml",
  showNumbers = true,
  fontSize = 12,
  beforeMount,
  editorRef,
  monacoRef,
  setEditorReady,
  onFocusChange,
  onInspectPosition,
  onToggleRunButton,
  showGlyphMargin = false,
}) => {
  const localMonacoRef = useRef<any>(null);
  const localEditorRef = useRef<any>(null);

  // Use passed refs if provided, else fallback to local refs
  const monacoRefToUse = monacoRef || localMonacoRef;
  const editorRefToUse = editorRef || localEditorRef;

  const toggleRunButtonRef = useRef(onToggleRunButton);
  useEffect(() => {
    toggleRunButtonRef.current = onToggleRunButton;
  }, [onToggleRunButton]);

  // Listen for VS Code theme changes and update Monaco theme
  useEffect(() => {
    const handler = () => {
      if (monacoRefToUse.current) {
        defineTheme(monacoRefToUse.current);
        monacoRefToUse.current.editor.setTheme(FIXED_BG_THEME);
      }
    };
    window.addEventListener("vscode:changeColorTheme", handler);
    return () => window.removeEventListener("vscode:changeColorTheme", handler);
  }, [monacoRefToUse]);

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
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for link underline used by YamlEditorPanel
  useEffect(() => {
    if (document.getElementById("mmt-link-underline-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-link-underline-style";
    style.innerHTML = `
      .mmt-link-underline {
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for yellow underline on undefined inputs passed to imported items
  useEffect(() => {
    if (document.getElementById("mmt-undefined-input-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-undefined-input-style";
    style.innerHTML = `
      .mmt-undefined-input-underline {
        text-decoration: underline wavy;
        text-decoration-color: #e2c358;
        text-underline-offset: 3px;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for run glyph rendered in the gutter
  useEffect(() => {
    if (document.getElementById("mmt-run-glyph-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-run-glyph-style";
    style.innerHTML = `
      .mmt-run-glyph {
        color: var(--vscode-testing-iconPassed, #3fb950);
        cursor: pointer;
        font-family: "codicon";
        font-size: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
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

  const editorDidMount = (editor: any) => {
    editorRefToUse.current = editor;
    editor.onDidFocusEditorWidget?.(() => {
      if (typeof onFocusChange === "function") onFocusChange(true);
    });
    editor.onDidBlurEditorWidget?.(() => {
      if (typeof onFocusChange === "function") onFocusChange(false);
    });
    // Add simple context menu action to log current cursor position
    if (onInspectPosition) {
      editor.addAction({
        id: "mmt.AddAsOutputVariable",
        label: "Add As Output Variable",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 99,
        run: () => {
          const pos = editor.getPosition();
          if (!pos) {
            return;
          }
          const text = editor.getValue();
          onInspectPosition({
            line: pos.lineNumber,
            column: pos.column,
            text,
          });
        },
      });
    }
    if (onToggleRunButton) {
      editor.addAction({
        id: "mmt.RunAPI",
        label: "Run API",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 98,
        run: () => {
          toggleRunButtonRef.current?.();
        },
      });
    }
    // Mark editor as ready for consumers like YamlEditorPanel effects
    setEditorReady?.(true);
  };

  return (
    <MonacoEditor
      height="100%"
      width="100%"
      language={language}
      value={content}
      theme={FIXED_BG_THEME}
      beforeMount={monaco => {
        monacoRefToUse.current = monaco;
        defineTheme(monaco);
        beforeMount?.(monaco);
      }}
      onMount={editorDidMount}
      onChange={value => setContent(value ?? "")}
      options={{
        fontSize,
        minimap: { enabled: false },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        lineNumbers: showNumbers ? "on" : "off",
        glyphMargin: showGlyphMargin,
        lineDecorationsWidth: 0,
        scrollbar: {
          horizontal: "auto",
          vertical: "auto"
        }
      }}
    />
  );
};

export default TextEditor;