import React, { useEffect, useRef, useState } from "react";
import TextEditorPanel from "./TextEditorPanel";
import RequestPanel from "./RequestPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import parseYaml from "./yamlparser";
import './App.css';

const App: React.FC = () => {

  const [paneSize, setPaneSize] = useState(window.innerWidth / 2);
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
      <TextEditorPanel content={content} setContent={setContent} />
      <RequestPanel />
    </SplitPane>
  );
}

export default App;