import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import parseYaml from "./yamlParser";

// TypeScript declaration for window.vscode
declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

// Add this interface:
interface TextEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const TextEditorPanel: React.FC<TextEditorPanelProps> = ({ content, setContent }) => {
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
  }, [setContent]);

  useEffect(() => {
      let res = parseYaml(content);
      console.log(res);

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
    <div style={{ height: "100%" }}>
      <MonacoEditor
        height="100%"
        width="100%"
        language="yaml"
        value={content}
        theme="vs-dark"
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