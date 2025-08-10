import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import { FIXED_BG_THEME, defineTheme } from "./Theme";

interface TextEditorProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number;
  beforeMount?: (monaco: any) => void;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  setEditorReady?: (ready: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
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
}) => {
  const localMonacoRef = useRef<any>(null);
  const localEditorRef = useRef<any>(null);

  // Use passed refs if provided, else fallback to local refs
  const monacoRefToUse = monacoRef || localMonacoRef;
  const editorRefToUse = editorRef || localEditorRef;

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
  }, []);

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
        beforeMount={monaco => {
          monacoRefToUse.current = monaco;
          defineTheme(monaco);
          beforeMount?.(monaco);
        }}
        onMount={editor => {
          setEditorReady && setEditorReady(true);
          editorRefToUse.current = editor;
          // Listen for focus/blur
          editor.onDidFocusEditorWidget?.(() => {
            if (typeof onFocusChange === "function") onFocusChange(true);
          });
          editor.onDidBlurEditorWidget?.(() => {
            if (typeof onFocusChange === "function") onFocusChange(false);
          });
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

export default TextEditor;