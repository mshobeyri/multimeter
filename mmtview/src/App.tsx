import React, { useEffect, useRef, useState } from "react";
import EnvironmentPanel from "./environment/EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import APIPanel from "./api/APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./test/TestPanel";
import SuitePanel from "./suite/SuitePanel";
import DocPanel from "./doc/DocPanel";
import MockPanel from "./mock/MockPanel";
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
  const [panelSize, setPanelSize] = useState(() => window.innerWidth / 2);
  const [panelMode, setPanelMode] = useState<"full" | "yaml" | "ui">("full");

  const [content, setContent] = useState("");
  const [validContent, setValidContent] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
  const [mmtFilePath, setMmtFilePath] = useState<string | undefined>(undefined);
  const [projectRoot, setProjectRoot] = useState<string | undefined>(undefined);
  const [yamlFontSize, setYamlFontSize] = useState<number>(12);
  const [collapseDescription, setCollapseDescription] = useState<boolean>(false);

  const isInitLoad = useRef(true);
  const [yamlEditorFocused, setYamlEditorFocused] = useState(false);
  const lastWindowWidthRef = useRef(window.innerWidth);

  function uiSetContent(content: string) {
    if (!yamlEditorFocused) {
      setContent(content);
      setValidContent(content);
    }
  }

  function yamlSetContent(content: string) {
    setContent(content);
    if (content === "") {
      setValidContent(content);
      return;
    }
    try {
      const parsed = parseYaml(content);
      // Only update validContent when YAML parses and has no validation errors
      if (parsed) {
        setValidContent(content);
      }
    } catch {
      // Keep previous validContent on parse/validation failure
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "viewDocumentContent") {
        isInitLoad.current = true;
        setContent(message.content);

        // Only seed validContent if the initial document is valid;
        // otherwise leave it as-is (so UI doesn't see "{}" or "")
        try {
          const parsed = parseYaml(message.content);
          if (parsed) {
            setValidContent(message.content);
          }
          // else: do nothing, keep previous validContent
        } catch {
          // parsing failed: keep previous validContent
        }

        if (message.uri) setMmtFilePath(message.uri);
        if (message.projectRoot) setProjectRoot(message.projectRoot);
        if (message.mode) {
          if (message.mode === "compare") {
            setPanelSize(window.innerWidth);
          } else {
            setPanelSize(window.innerWidth / 2);
          }
        }
      }

      if (message.command === "multimeter.mmt.show.panel") {
        if (message.panelId === "full") {
          setPanelMode("full");
          setPanelSize(window.innerWidth / 2);
        } else if (message.panelId === "yaml") {
          setPanelMode("yaml");
          setPanelSize(window.innerWidth);
        } else if (message.panelId === "ui") {
          setPanelMode("ui");
          setPanelSize(0);
        }
      }

      if (message.command === "config") {
        const size = Number(message.editorFontSize);
        if (Number.isFinite(size) && size > 0) {
          setYamlFontSize(size);
        } else {
          setYamlFontSize(12);
        }
        // Apply default panel mode on initial load
        if (isInitLoad.current && message.defaultPanel) {
          if (message.defaultPanel === "yaml-ui") {
            setPanelMode("full");
            setPanelSize(window.innerWidth / 2);
          } else if (message.defaultPanel === "yaml") {
            setPanelMode("yaml");
            setPanelSize(window.innerWidth);
          } else if (message.defaultPanel === "ui") {
            setPanelMode("ui");
            setPanelSize(0);
          }
        }
        if (typeof message.collapseDescription === "boolean") {
          setCollapseDescription(message.collapseDescription);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setContent]);

  useEffect(() => {
    try {
      const parsed = parseYaml(validContent);
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        setDocType((parsed as any).type);
      } else {
        setDocType(null);
      }
    } catch {
      setDocType(null);
    }
  }, [validContent]);

  useEffect(() => {
    if (isInitLoad.current) {
      isInitLoad.current = false;
      return;
    }
    window.vscode?.postMessage({ command: "updateDocumentContent", text: content });
  }, [content]);

  useEffect(() => {
    window.vscode?.postMessage({ command: "loadDocumentContent" });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (panelMode === "full") {
        const newWidth = window.innerWidth;
        const min = 300;
        const max = Math.max(newWidth - 300, min);
        setPanelSize(prevSize => {
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
      } else if (panelMode === "yaml") {
        setPanelSize(window.innerWidth);
      } else if (panelMode === "ui") {
        setPanelSize(0);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [panelMode]);

  return (
    <FileContext.Provider value={{ mmtFilePath, projectRoot }}>
      <SplitPane
        split="vertical"
        size={panelSize}
        onChange={(size) => {
          setPanelSize(size);
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
            setContent={yamlSetContent}
            onFocusChange={setYamlEditorFocused}
            fontSize={yamlFontSize}
            collapseDescription={collapseDescription}
          />
        </div>
        <div style={{ height: "100vh", minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowX: 'auto' }}>
          <div style={{ width: '100%', height: '100%', maxWidth: 1200, minWidth: 450 }}>
            {docType === "env" && (
              <EnvironmentPanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === "api" && (
              <APIPanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === "doc" && (
              <DocPanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === "test" && (
              <TestPanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === "suite" && (
              <SuitePanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === "server" && (
              <MockPanel content={validContent} setContent={uiSetContent} />
            )}
            {docType === null && (
              <NotypePanel content={validContent} setContent={uiSetContent} />
            )}
          </div>
        </div>
      </SplitPane>
    </FileContext.Provider>
  );
}

export default App;