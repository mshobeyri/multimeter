import React, { useEffect, useRef, useState, createContext } from "react";
import EnvironmentPanel from "./environment/EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import VariablesPanel from "./variable/VariablesPanel";
import APIPanel from "./api/APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./test/TestPanel";
import DocPanel from "./doc/DocPanel";
import parseYaml from "mmt-core/markupConvertor";
import YamlEditorPanel from "./text/YamlEditorPanel";

declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

// Create a context for file info
export const FileContext = createContext<{ filePath?: string; fileName?: string }>({});


const App: React.FC = () => {
  // Pane size defaults to half the window width and remains in-memory only
  const [paneSize, setPaneSize] = useState(() => window.innerWidth / 2);
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | undefined>(undefined);

  const isInitLoad = useRef(true);
  const [yamlEditorFocused, setYamlEditorFocused] = useState(false);

  function uiSetContent(setContent: (c: string) => void) {
    return (value: string) => {
      if (!yamlEditorFocused) {
        setContent(value);
      }
    };
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "loadDocument") {
        isInitLoad.current = true;
        setContent(message.content);
        if (message.uri) setFilePath(message.uri);
        if (message.mode) {
          if (message.mode === "compare") {
            setPaneSize(window.innerWidth);
          } else {
            setPaneSize(window.innerWidth / 2);
          }
        }
      }

      if (message.command === "multimeter.mmt.show.panel") {
        if (message.panelId === "full") {
          setPaneSize(window.innerWidth / 2);
        } else if (message.panelId === "yaml") {
          setPaneSize(window.innerWidth);
        } else if (message.panelId === "ui") {
          setPaneSize(0);
        }
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
      setPaneSize(window.innerWidth / 2);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const uiSetContentHandler = uiSetContent(setContent);

  return (
    <FileContext.Provider value={{ filePath }}>
      <SplitPane
        split="vertical"
        size={paneSize}
        onChange={(size) => {
          setPaneSize(size);
        }}
        minSize={300}
        maxSize={window.innerWidth - 300}
        style={{
          height: "100vh",
          width: "100vw",
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          fontFamily: "var(--vscode-editor-font-family, sans-serif)",
          fontSize: "var(--vscode-editor-font-size, 14px)",
        }}
      >
        <div style={{ height: "100vh", minHeight: 0 }}>
          <YamlEditorPanel
            content={content}
            setContent={setContent}
            onFocusChange={setYamlEditorFocused}
          />
        </div>
        <div style={{ height: "100vh", minHeight: 0 }}>
          {docType === "env" && (
            <EnvironmentPanel content={content} setContent={uiSetContentHandler} />
          )}
          {docType === "var" && (
            <VariablesPanel content={content} setContent={uiSetContentHandler} />
          )}
          {docType === "api" && (
            <APIPanel content={content} setContent={uiSetContentHandler} />
          )}
          {docType === "doc" && (
            <DocPanel content={content} setContent={uiSetContentHandler} />
          )}
          {docType === "test" && (
            <TestPanel content={content} setContent={uiSetContentHandler} />
          )}
          {docType === null && (
            <NotypePanel content={content} setContent={uiSetContentHandler} />
          )}
        </div>
      </SplitPane>
    </FileContext.Provider>
  );
}

export default App;