import React, { useEffect, useRef, useState } from "react";
import TextEditorPanel from "./TextEditorPanel";
import EnvironmentPanel from "./EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import CommonsPanel from "./CommonsPanel";
import APIPanel from "./APIPanel";

declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

const App: React.FC = () => {
  const [paneSize, setPaneSize] = useState(window.innerWidth / 2);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const isInitLoad = useRef(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "loadDocument") {
        isInitLoad.current = true;
        setContent(message.content);
        // Extract file name from URI
        try {
          const uri = message.uri || "";
          const name = uri.split("/").pop() || "";
          setFileName(name);
        } catch {
          setFileName(null);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setContent]);

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
        highlightPrefixes={["i", "custom", "foo", "bar"]}
      />
      {fileName === "_environments.mmt" && (
        <EnvironmentPanel content={content} setContent={setContent} />
      )}
      {fileName === "_parameters.mmt" && (
        <CommonsPanel content={content} setContent={setContent} />
      )}
      {fileName && fileName.startsWith("i") && (
        <APIPanel content={content} setContent={setContent} />
      )}
    </SplitPane>
  );
}

export default App;