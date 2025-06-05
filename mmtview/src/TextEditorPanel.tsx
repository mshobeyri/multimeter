import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";

interface TextEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const TextEditorPanel: React.FC<TextEditorPanelProps> = ({ content, setContent }) => {
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