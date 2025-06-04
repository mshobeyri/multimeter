import React, { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";


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
    <div style={{ flex: `0 0 ${width}%`, height: "100%" }}>
      <MonacoEditor
        height="100%"
        width="100%"
        language="plaintext"
        value={content}
        theme="vs-dark"     
        onChange={value => setContent(value ?? "")}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          wordWrap: "on",
          // You can add more options to match VS Code settings
      }}
    />
    </div>
  );
};

export default EditorPanel;