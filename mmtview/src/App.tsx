import React, { useEffect, useRef, useState } from "react";
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
import { FileContext } from "./fileContext";

declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

const App: React.FC = () => {
  // Pane size defaults to half the window width and remains in-memory only
  const [paneSize, setPaneSize] = useState(() => window.innerWidth / 2);
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | undefined>(undefined);

  const isInitLoad = useRef(true);
  const [yamlEditorFocused, setYamlEditorFocused] = useState(false);
  const lastWindowWidthRef = useRef(window.innerWidth);

  function uiSetContent(content: string) {
    if (!yamlEditorFocused) {
      setContent(content);
    }
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
      const newWidth = window.innerWidth;
      const min = 300;
      const max = Math.max(newWidth - 300, min);
      setPaneSize(prevSize => {
        const prevWidth = lastWindowWidthRef.current || newWidth;
        if (prevWidth === 0) {
          const fallback = Math.round(newWidth / 2);
          return Math.min(Math.max(fallback, min), max);
        }
        const ratio = prevSize / prevWidth;
        const desired = Math.round(ratio * newWidth);
        const clamped = Math.min(Math.max(desired, min), max);
        return clamped;
      });
      lastWindowWidthRef.current = newWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
            <EnvironmentPanel content={content} setContent={uiSetContent} />
          )}
          {docType === "var" && (
            <VariablesPanel content={content} setContent={uiSetContent} />
          )}
          {docType === "api" && (
            <APIPanel content={content} setContent={uiSetContent} />
          )}
          {docType === "doc" && (
            <DocPanel content={content} setContent={uiSetContent} />
          )}
          {docType === "test" && (
            <TestPanel content={content} setContent={uiSetContent} />
          )}
          {docType === null && (
            <NotypePanel content={content} setContent={uiSetContent} />
          )}
        </div>
      </SplitPane>
    </FileContext.Provider>
  );
}

export default App;