import React, { useEffect, useRef, useState } from "react";


// TypeScript declaration for window.vscode
declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

const EditorPanel: React.FC<{ width: number }> = ({ width }) => {
  const [content, setContent] = useState("");
  const isInitLoad = useRef(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "loadDocument") {
        isInitLoad.current = true;
        setContent(message.content);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (isInitLoad.current) {
      isInitLoad.current = false;
      return;
    }
    window.vscode?.postMessage({ command: "update", text: content });
  }, [content]);

  useEffect(() => {
    window.vscode?.postMessage({ command: "ready" });
  }, []);

  return (
    <textarea
      id="editor"
      value={content}      
      onChange={e => setContent(e.target.value)}
      style={{
        flex: `0 0 ${width}%`,
        padding: "1rem",
        boxSizing: "border-box",
        border: "none",
        resize: "none",
        borderRight: "1px solid var(--vscode-editorGroup-border)",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        minWidth: 100,
        maxWidth: "80vw",
        overflow: "auto",
        height: "100%",
      }}
    />
  );
};

export default EditorPanel;