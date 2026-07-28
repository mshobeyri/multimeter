import React, { useEffect, useMemo, useRef, useState } from "react";
import EnvironmentPanel from "./environment/EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import APIPanel from "./api/APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./test/TestPanel";
import BrunoTestPanel from "./bruno/BrunoTestPanel";
import HttpTestPanel from "./http/HttpTestPanel";
import SuitePanel from "./suite/SuitePanel";
import LoadTestPanel from "./loadtest/LoadTestPanel";
import DocPanel from "./doc/DocPanel";
import MockPanel from "./mock/MockPanel";
import ReportPanel from "./report/ReportPanel";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import { isBrunoFilePath, parseBrunoDocument } from "mmt-core/brunoParsePack";
import { isHttpFilePath, parseHttpDocument } from "mmt-core/httpParsePack";
import { normalizeNewlines } from "mmt-core/textLines";
import YamlEditorPanel from "./text/YamlEditorPanel";
import { FileContext } from "./fileContext";
import PanelErrorBoundary from "./shared/PanelErrorBoundary";
import { ensureThemeSync } from "./text/Theme";

/** Monaco always uses LF; normalize so controlled value never flip-flops CRLF↔LF. */
function toEditorText(text: string): string {
  return normalizeNewlines(text ?? "");
}

/** True when YAML parses without document errors (keeps UI off mid-typing junk like `url: http:`). */
function isUsableMmtYaml(content: string): boolean {
  try {
    const doc = parseYamlDoc(content);
    if (!doc || (doc.errors && doc.errors.length > 0)) {
      return false;
    }
    return Boolean(parseYaml(content));
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
    };
  }
}

type PanelMode = "full" | "yaml" | "ui";

type WebviewViewState = {
  documentUri?: string;
  panelMode?: PanelMode;
  panelSize?: number;
  panelRatio?: number;
  windowWidth?: number;
};

const minPanelSize = 300;
const defaultPanelRatio = 0.5;

function isPanelMode(value: unknown): value is PanelMode {
  return value === "full" || value === "yaml" || value === "ui";
}

function clampPanelSize(size: number, mode: PanelMode, width: number) {
  if (mode === "yaml") {
    return width;
  }
  if (mode === "ui") {
    return 0;
  }
  const max = Math.max(width - minPanelSize, minPanelSize);
  return Math.min(Math.max(size, minPanelSize), max);
}

function defaultPanelSize(mode: PanelMode, width: number) {
  if (mode === "yaml") {
    return width;
  }
  if (mode === "ui") {
    return 0;
  }
  return clampPanelSize(width / 2, mode, width);
}

function isUsableLayoutWidth(width: number) {
  return Number.isFinite(width) && width >= minPanelSize * 2;
}

function clampPanelRatio(ratio: number, width: number) {
  if (!isUsableLayoutWidth(width)) {
    return defaultPanelRatio;
  }
  const minRatio = minPanelSize / width;
  const maxRatio = 1 - minRatio;
  return Math.min(Math.max(ratio, minRatio), maxRatio);
}

function panelSizeFromRatio(ratio: number, width: number) {
  return clampPanelSize(Math.round(clampPanelRatio(ratio, width) * width), "full", width);
}

function readSavedViewState(documentUri?: string) {
  const savedState = (window.vscode as any)?.getState?.() as WebviewViewState | undefined;
  const savedPanelMode = savedState?.panelMode;
  const hasSavedState = !!documentUri && savedState?.documentUri === documentUri &&
    (!savedPanelMode || savedPanelMode === "full");
  const panelMode = hasSavedState && isPanelMode(savedPanelMode) ? savedPanelMode : "full";
  const width = window.innerWidth;
  let panelSize = defaultPanelSize(panelMode, width);

  if (hasSavedState && typeof savedState?.panelRatio === "number" && Number.isFinite(savedState.panelRatio)) {
    panelSize = panelSizeFromRatio(savedState.panelRatio, width);
  } else if (hasSavedState && typeof savedState?.panelSize === "number" && Number.isFinite(savedState.panelSize)) {
    if (panelMode === "full" && typeof savedState.windowWidth === "number" && savedState.windowWidth > 0) {
      panelSize = (savedState.panelSize / savedState.windowWidth) * width;
    } else {
      panelSize = savedState.panelSize;
    }
  }

  return {
    hasSavedState,
    panelMode,
    panelSize: clampPanelSize(panelSize, panelMode, width),
  };
}

const App: React.FC = () => {
  const splitHostRef = useRef<HTMLDivElement | null>(null);
  const initialViewState = useRef(readSavedViewState());
  const [panelSize, setPanelSize] = useState(() => initialViewState.current.panelSize);
  const [panelMode, setPanelMode] = useState<PanelMode>(() => initialViewState.current.panelMode);
  const panelSizeRef = useRef(initialViewState.current.panelSize);
  const lastFullPanelSizeRef = useRef(initialViewState.current.panelSize);
  const lastFullPanelRatioRef = useRef(defaultPanelRatio);
  const lastPanelDebugRef = useRef<{message: string; time: number} | null>(null);

  const [content, setContent] = useState("");
  const [validContent, setValidContent] = useState("");
  const [documentContentLoaded, setDocumentContentLoaded] = useState(false);
  const [sourceFormat, setSourceFormat] = useState<"mmt" | "http" | "bruno">("mmt");
  const [mmtFilePath, setMmtFilePath] = useState<string | undefined>(undefined);
  const [projectRoot, setProjectRoot] = useState<string | undefined>(undefined);
  const [yamlFontSize, setYamlFontSize] = useState<number>(12);
  const [collapseDescription, setCollapseDescription] = useState<boolean>(false);

  const isInitLoad = useRef(true);
  const [yamlEditorFocused, setYamlEditorFocused] = useState(false);
  const lastWindowWidthRef = useRef(window.innerWidth);

  useEffect(() => {
    ensureThemeSync();
  }, []);

  function getLayoutWidth() {
    if (splitHostRef.current) {
      return Math.round(splitHostRef.current.getBoundingClientRect().width);
    }
    return Math.round(window.innerWidth);
  }

  function isLayoutVisible(width = getLayoutWidth()) {
    return !document.hidden && isUsableLayoutWidth(width);
  }

  function debugPanelState(message: string) {
    const now = Date.now();
    const last = lastPanelDebugRef.current;
    if (last && last.message === message && now - last.time < 1000) {
      return;
    }
    lastPanelDebugRef.current = {message, time: now};
    window.vscode?.postMessage({command: "logToOutput", level: "debug", message: `[panel] ${message}`});
  }

  function uiSetContent(next: string, options?: { force?: boolean }) {
    if (!yamlEditorFocused || options?.force) {
      setContent(next);
      setValidContent(next);
    }
  }

  function yamlSetContent(content: string) {
    setContent(content);
    if (content === "") {
      setValidContent(content);
      return;
    }
    if (sourceFormat === "http") {
      const parsed = parseHttpDocument(content);
      if (parsed.requests.length > 0) {
        setValidContent(content);
      }
      return;
    }
    if (sourceFormat === "bruno") {
      const parsed = parseBrunoDocument(content);
      if (parsed.blocks.length > 0) {
        setValidContent(content);
      }
      return;
    }
    try {
      if (isUsableMmtYaml(content)) {
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
        setDocumentContentLoaded(true);
        if (typeof message.uri === "string") {
          const savedViewState = readSavedViewState(message.uri);
          initialViewState.current = savedViewState;
          if (savedViewState.hasSavedState) {
            setPanelMode(savedViewState.panelMode);
            setPanelSize(savedViewState.panelSize);
            const width = getLayoutWidth();
            if (savedViewState.panelMode === "full" && isUsableLayoutWidth(width)) {
              lastFullPanelRatioRef.current = clampPanelRatio(savedViewState.panelSize / width, width);
            }
            lastWindowWidthRef.current = window.innerWidth;
          }
        }
        const nextSourceFormat = message.sourceFormat === "http" || isHttpFilePath(message.uri || "") ? "http" :
          message.sourceFormat === "bruno" || isBrunoFilePath(message.uri || "") ? "bruno" : "mmt";
        setSourceFormat(nextSourceFormat);
        setContent(toEditorText(message.content));

        // Only seed validContent if the initial document is valid;
        // otherwise leave it as-is (so UI doesn't see "{}" or "")
        if (nextSourceFormat === "http") {
          const parsed = parseHttpDocument(message.content);
          if (parsed.requests.length > 0) {
            setValidContent(toEditorText(message.content));
          }
        } else if (nextSourceFormat === "bruno") {
          const parsed = parseBrunoDocument(message.content);
          if (parsed.blocks.length > 0) {
            setValidContent(toEditorText(message.content));
          }
        } else {
          try {
            const editorText = toEditorText(message.content);
            if (isUsableMmtYaml(editorText)) {
              setValidContent(editorText);
            }
            // else: do nothing, keep previous validContent
          } catch {
            // parsing failed: keep previous validContent
          }
        }

        if (message.uri) setMmtFilePath(message.uri);
        if (message.projectRoot) setProjectRoot(message.projectRoot);
      }

      // External document change (undo / revert) – update content without
      // echoing an updateDocumentContent message back to the extension.
      if (message.command === "documentContentChanged") {
        const nextSourceFormat = message.sourceFormat === "http" || isHttpFilePath(message.uri || mmtFilePath || "") ? "http" :
          message.sourceFormat === "bruno" || isBrunoFilePath(message.uri || mmtFilePath || "") ? "bruno" : sourceFormat;
        setSourceFormat(nextSourceFormat);
        const editorText = toEditorText(message.content);
        setContent(prev => {
          if (prev === editorText) {
            return prev;
          }
          isInitLoad.current = true;
          return editorText;
        });
        if (nextSourceFormat === "http") {
          const parsed = parseHttpDocument(editorText);
          if (parsed.requests.length > 0) {
            setValidContent(editorText);
          }
        } else if (nextSourceFormat === "bruno") {
          const parsed = parseBrunoDocument(editorText);
          if (parsed.blocks.length > 0) {
            setValidContent(editorText);
          }
        } else {
          try {
            if (isUsableMmtYaml(editorText)) {
              setValidContent(editorText);
            }
          } catch {
            // keep previous validContent
          }
        }
      }

      if (message.command === "multimeter.mmt.show.panel") {
        const width = getLayoutWidth();
        if (message.panelId === "full") {
          setPanelMode("full");
          lastFullPanelRatioRef.current = defaultPanelRatio;
          setPanelSize(defaultPanelSize("full", width));
        } else if (message.panelId === "yaml") {
          setPanelMode("yaml");
          setPanelSize(width);
        } else if (message.panelId === "ui") {
          setPanelMode("ui");
          setPanelSize(0);
        }
        lastWindowWidthRef.current = window.innerWidth;
      }

      if (message.command === "config") {
        if (typeof message.bodyAutoFormat === "boolean") {
          (window as any).__mmtBodyAutoFormat = message.bodyAutoFormat;
          window.dispatchEvent(new CustomEvent("multimeter.config", { detail: message }));
        }
        const size = Number(message.editorFontSize);
        if (Number.isFinite(size) && size > 0) {
          setYamlFontSize(size);
        } else {
          setYamlFontSize(12);
        }
        // Apply default panel mode on initial load
        if (isInitLoad.current && !initialViewState.current.hasSavedState && message.defaultPanel) {
          const width = getLayoutWidth();
          if (message.defaultPanel === "yaml-ui") {
            setPanelMode("full");
            lastFullPanelRatioRef.current = defaultPanelRatio;
            setPanelSize(defaultPanelSize("full", width));
          } else if (message.defaultPanel === "yaml") {
            setPanelMode("yaml");
            setPanelSize(defaultPanelSize("yaml", width));
          } else if (message.defaultPanel === "ui") {
            setPanelMode("ui");
            setPanelSize(defaultPanelSize("ui", width));
          }
          lastWindowWidthRef.current = window.innerWidth;
        }
        if (typeof message.collapseDescription === "boolean") {
          setCollapseDescription(message.collapseDescription);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setContent, mmtFilePath, sourceFormat]);

  const docType = useMemo(() => {
    if (sourceFormat === "http" || sourceFormat === "bruno") {
      return validContent.trim() ? "test" : null;
    }
    try {
      const parsed = parseYaml(validContent);
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        return (parsed as { type?: string }).type ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }, [validContent, sourceFormat]);

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
    panelSizeRef.current = panelSize;
  }, [panelSize]);

  useEffect(() => {
    if (!mmtFilePath) {
      return;
    }
    const width = getLayoutWidth();
    if (document.hidden || !isUsableLayoutWidth(width)) {
      debugPanelState(`ignore save while hidden/narrow width=${width} mode=${panelMode} size=${panelSize}`);
      return;
    }
    if (panelMode === "full") {
      lastFullPanelSizeRef.current = panelSize;
      lastFullPanelRatioRef.current = clampPanelRatio(panelSize / width, width);
    }
    (window.vscode as any)?.setState?.({
      documentUri: mmtFilePath,
      panelSize: lastFullPanelSizeRef.current,
      panelRatio: lastFullPanelRatioRef.current,
      windowWidth: width,
    });
  }, [mmtFilePath, panelMode, panelSize]);

  useEffect(() => {
    const handleLayoutChange = () => {
      const newWidth = getLayoutWidth();
      if (document.hidden || !isUsableLayoutWidth(newWidth)) {
        debugPanelState(`ignore resize while hidden/narrow width=${newWidth} mode=${panelMode} size=${panelSizeRef.current}`);
        return;
      }
      if (panelMode === "full") {
        setPanelSize(panelSizeFromRatio(lastFullPanelRatioRef.current, newWidth));
        lastWindowWidthRef.current = newWidth;
      } else if (panelMode === "yaml") {
        setPanelSize(newWidth);
      } else if (panelMode === "ui") {
        setPanelSize(0);
      }
    };
    window.addEventListener("resize", handleLayoutChange);
    document.addEventListener("visibilitychange", handleLayoutChange);
    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      document.removeEventListener("visibilitychange", handleLayoutChange);
    };
  }, [panelMode]);

  return (
    <FileContext.Provider value={{ mmtFilePath, projectRoot }}>
      <div ref={splitHostRef} style={{ height: "100%", width: "100%", overflow: "hidden" }}>
      <SplitPane
        split="vertical"
        size={panelSize}
        onChange={(size) => {
          const width = getLayoutWidth();
          if (!isLayoutVisible(width)) {
            debugPanelState(`ignore split change while hidden/narrow width=${width} mode=${panelMode} size=${size}`);
            return;
          }
          if (panelMode === "full") {
            lastFullPanelRatioRef.current = clampPanelRatio(size / width, width);
          }
          setPanelSize(size);
        }}
        minSize={minPanelSize}
        maxSize={Math.max(getLayoutWidth() - minPanelSize, minPanelSize)}
        style={{
          height: "100%",
          width: "100%",
          overflow: "hidden",
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          fontFamily: "var(--vscode-editor-font-family, sans-serif)",
          fontSize: "var(--vscode-editor-font-size, 14px)",
        }}
      >
        <div style={{ height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          <YamlEditorPanel
            content={content}
            setContent={yamlSetContent}
            onFocusChange={setYamlEditorFocused}
            fontSize={yamlFontSize}
            collapseDescription={collapseDescription}
            language={sourceFormat === "http" || sourceFormat === "bruno" ? "http" : "yaml"}
            sourceFormat={sourceFormat}
          />
        </div>
        <div style={{ height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", maxWidth: 1200, minWidth: 450, margin: "0 auto", overflow: "auto" }}>
            <PanelErrorBoundary resetKey={`${docType || "none"}::${validContent}`}>
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
                sourceFormat === "http" ?
                  <HttpTestPanel content={validContent} setContent={uiSetContent} /> :
                  sourceFormat === "bruno" ?
                  <BrunoTestPanel content={validContent} setContent={uiSetContent} /> :
                  <TestPanel content={validContent} setContent={uiSetContent} />
              )}
              {docType === "suite" && (
                <SuitePanel content={validContent} setContent={uiSetContent} />
              )}
              {docType === "loadtest" && (
                <LoadTestPanel content={validContent} setContent={uiSetContent} />
              )}
              {docType === "server" && (
                <MockPanel content={validContent} setContent={uiSetContent} />
              )}
              {docType === "report" && (
                <ReportPanel content={validContent} setContent={uiSetContent} />
              )}
              {documentContentLoaded && docType === null && (
                <NotypePanel content={validContent} setContent={uiSetContent} />
              )}
            </PanelErrorBoundary>
          </div>
        </div>
      </SplitPane>
      </div>
    </FileContext.Provider>
  );
}

export default App;