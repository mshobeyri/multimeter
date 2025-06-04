import React, { useState } from "react";
import EditorPanel from "./EditorPanel";
import RequestPanel from "./RequestPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';

const App: React.FC = () => {

  const [paneSize, setPaneSize] = useState(window.innerWidth / 2);

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
      <EditorPanel />
      <RequestPanel />
    </SplitPane>
  );
}

export default App;