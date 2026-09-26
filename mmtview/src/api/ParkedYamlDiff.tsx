import React, { useEffect, useRef } from "react";
import { loader } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { defineTheme, getMonacoThemeName } from "../text/Theme";

const HIDE_UNCHANGED = {
  enabled: true,
  contextLineCount: 1,
  minimumLineCount: 3,
  revealLineCount: 20,
} as const;

const DIFF_HEIGHT_PX = 240;

interface ParkedYamlDiffProps {
  original: string;
  modified: string;
  visible: boolean;
}

/**
 * Direct monaco.editor.createDiffEditor (not @monaco-editor/react DiffEditor).
 * Stays mounted in its slot — never reparent the host DOM (that kills diff
 * decorations / hideUnchangedRegions). Parent parks the popup off-screen.
 */
const ParkedYamlDiff: React.FC<ParkedYamlDiffProps> = ({
  original,
  modified,
  visible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const modifiedModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const originalRef = useRef(original);
  const modifiedRef = useRef(modified);
  originalRef.current = original;
  modifiedRef.current = modified;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    void loader.init().then((monaco) => {
      if (cancelled || !containerRef.current) {
        return;
      }
      defineTheme(monaco);
      monaco.editor.setTheme(getMonacoThemeName());

      const originalModel = monaco.editor.createModel(
        originalRef.current,
        "yaml",
        monaco.Uri.parse(`inmemory://mmt/unsaved-diff/original-${Date.now()}`)
      );
      const modifiedModel = monaco.editor.createModel(
        modifiedRef.current,
        "yaml",
        monaco.Uri.parse(`inmemory://mmt/unsaved-diff/modified-${Date.now()}`)
      );
      originalModelRef.current = originalModel;
      modifiedModelRef.current = modifiedModel;

      const editor = monaco.editor.createDiffEditor(containerRef.current, {
        readOnly: true,
        contextmenu: false,
        renderSideBySide: false,
        diffWordWrap: "on",
        hideUnchangedRegions: { ...HIDE_UNCHANGED },
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbers: "off",
        glyphMargin: false,
        folding: false,
        renderOverviewRuler: false,
        overviewRulerLanes: 0,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        renderIndicators: true,
        ignoreTrimWhitespace: false,
        originalEditable: false,
      });
      editor.setModel({ original: originalModel, modified: modifiedModel });
      editorRef.current = editor;
      editor.layout();
    });

    return () => {
      cancelled = true;
      // Parent keeps this mounted while parked. Dispose only on true unmount
      // (file change); YAML editor remounts on path change too.
      editorRef.current?.dispose();
      editorRef.current = null;
      originalModelRef.current?.dispose();
      originalModelRef.current = null;
      modifiedModelRef.current?.dispose();
      modifiedModelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const originalModel = originalModelRef.current;
    const modifiedModel = modifiedModelRef.current;
    if (!originalModel || !modifiedModel) {
      return;
    }
    if (originalModel.getValue() !== original) {
      originalModel.setValue(original);
    }
    if (modifiedModel.getValue() !== modified) {
      modifiedModel.setValue(modified);
    }
  }, [original, modified]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !visible) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      void loader.init().then((m) => {
        m.editor.setTheme(getMonacoThemeName());
      });
      editor.layout();
      // Re-assert collapse after layout; zero-size periods can leave it off.
      editor.updateOptions({
        diffWordWrap: "on",
        hideUnchangedRegions: { enabled: false },
      });
      editor.updateOptions({
        diffWordWrap: "on",
        hideUnchangedRegions: { ...HIDE_UNCHANGED },
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, original, modified]);

  return (
    <div
      ref={containerRef}
      style={{ height: DIFF_HEIGHT_PX, width: "100%" }}
    />
  );
};

export default ParkedYamlDiff;
