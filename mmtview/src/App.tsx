import React, { useEffect, useRef, useState } from "react";
import TextEditorPanel from "./TextEditorPanel";
import EnvironmentPanel from "./EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import VariablesPanel from "./VariablesPanel";
import APIPanel from "./APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./TestPanel"; // Add this import
import parseYaml from "./markupConvertor";

declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

const typeOptions = [
  { value: "api", label: "API" },
  { value: "env", label: "Environment" },
  { value: "param", label: "Parameters" }
];

const App: React.FC = () => {
  const [paneSize, setPaneSize] = useState(window.innerWidth / 2);
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
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

  // Parse YAML and extract "type" property
  useEffect(() => {
    try {
      const parsed = parseYaml(content);
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        setDocType((parsed as any).type);
      } else {
        setDocType(null);
      }
    } catch {
      setDocType(null);
    }
  }, [content]);

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
    <SplitPane
      split="vertical"
      size={paneSize}
      onChange={(size) => setPaneSize(size)}
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        fontFamily: "var(--vscode-editor-font-family, sans-serif)",
        fontSize: "var(--vscode-editor-font-size, 14px)",
      }}
    >
      <TextEditorPanel
        content={content}
        setContent={setContent}
      />
      {docType === "env" && (
        <EnvironmentPanel content={content} setContent={setContent} />
      )}
      {docType === "var" && (
        <VariablesPanel content={content} setContent={setContent} />
      )}
      {docType === "api" && (
        <APIPanel content={content} setContent={setContent} />
      )}
      {docType === "test" && (
        <TestPanel content={content} setContent={setContent} />
      )}
      {docType === null && (
        <NotypePanel content={content} setContent={setContent} />
      )}
    </SplitPane>
  );
}

export default App;