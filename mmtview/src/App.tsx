import React, { useEffect, useRef, useState, createContext } from "react";
import EnvironmentPanel from "./environment/EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import VariablesPanel from "./variable/VariablesPanel";
import APIPanel from "./api/APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./test/TestPanel";
import parseYaml from "./markupConvertor";
import  YamlEditorPanel from "./text/YamlEditorPanel";

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

const SPLIT_PANE_KEY = "mmtview:splitPaneSize";

// Create a context for file info
export const FileContext = createContext<{ filePath?: string; fileName?: string }>({});

const App: React.FC = () => {
  // Restore pane size from localStorage or default to half window width
  const [paneSize, setPaneSize] = useState(() => {
    const saved = localStorage.getItem(SPLIT_PANE_KEY);
    return saved ? Number(saved) : window.innerWidth / 2;
  });
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const isInitLoad = useRef(true);

  // Save pane size to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(SPLIT_PANE_KEY, String(paneSize));
  }, [paneSize]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "loadDocument") {
        isInitLoad.current = true;
        setContent(message.content);
        if (message.uri) setFilePath(message.uri);
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

  useEffect(() => {
    const handleResize = () => {
      // Reset to 50/50 split on window resize
      setPaneSize(window.innerWidth / 2);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <FileContext.Provider value={{ filePath }}>
      <SplitPane
        split="vertical"
        size={paneSize}
        onChange={(size) => setPaneSize(size)}
        minSize={300}           // Minimum width of the left panel
        maxSize={window.innerWidth - 300} // Right panel will be at least 300px wide
        style={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          fontFamily: "var(--vscode-editor-font-family, sans-serif)",
          fontSize: "var(--vscode-editor-font-size, 14px)",
        }}
      >
        <YamlEditorPanel
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
    </FileContext.Provider>
  );
}

export default App;