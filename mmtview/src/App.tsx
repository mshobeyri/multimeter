import React, { useRef, useState, useEffect } from "react";
import EditorPanel from "./EditorPanel";
import RequestPanel from "./RequestPanel";
import './App.css';

const App: React.FC = () => {
  const [editorWidth, setEditorWidth] = useState(50); // percent
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let percent = ((e.clientX - rect.left) / rect.width) * 100;
      percent = Math.max(10, Math.min(90, percent));
      setEditorWidth(percent);
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
  };

  return (
    <div
      id="container"
      ref={containerRef}
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        fontFamily: "var(--vscode-editor-font-family, sans-serif)",
        fontSize: "var(--vscode-editor-font-size, 14px)",
      }}
    >
      <EditorPanel width={editorWidth} />
      <div
        id="splitter"
        style={{
          width: 5,
          cursor: "col-resize",
          background: "var(--vscode-editorGroup-border, #444)",
          userSelect: "none",
          zIndex: 10,
        }}
        onMouseDown={handleMouseDown}
      />
      <RequestPanel width={100 - editorWidth} />
    </div>
  );
}

export default App;
