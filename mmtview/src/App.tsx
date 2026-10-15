import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnvironmentPanel from "./environment/EnvironmentPanel";
import { SplitPane } from '@rexxars/react-split-pane';
import './App.css';
import APIPanel from "./api/APIPanel";
import NotypePanel from "./NotypePanel";
import TestPanel from "./test/TestPanel";
import BrunoPanel from "./bruno/BrunoPanel";
import HttpPanel from "./http/HttpPanel";
import SuitePanel from "./suite/SuitePanel";
import LoadTestPanel from "./loadtest/LoadTestPanel";
import DocPanel from "./doc/DocPanel";
import MockPanel from "./mock/MockPanel";
import JudgePanel from "./judge/JudgePanel";
import ReportPanel from "./report/ReportPanel";
import parseYaml, { parseYamlDoc } from "mmt-core/parse/markupConvertor";
import { isBrunoCollectionFilePath, isBrunoFilePath, parseBrunoDocument, type BrunoSourceFile } from "mmt-core/parse/brunoParsePack";
import { applyViewDocumentGitSnapshot } from "./api/apiTesterSend";
import { isHttpFilePath, parseHttpDocument } from "mmt-core/parse/httpParsePack";
import { normalizeNewlines } from "mmt-core/util/textLines";
import YamlEditorPanel from "./text/YamlEditorPanel";
import { FileContext } from "./fileContext";
import PanelErrorBoundary from "./shared/PanelErrorBoundary";
import { ensureThemeSync } from "./text/Theme";
import { cacheBodyAutoFormat } from "./api/bodyAutoFormatConfig";
import { cacheBodyLineNumbers } from "./api/bodyLineNumbersConfig";
import { collectYamlEditorErrors } from "./text/yamlEditorErrors";
import { cacheReportSpillBytes } from "./shared/reportSpillConfig";
import YamlErrorWarning, { YamlErrorDim } from "./api/YamlErrorWarning";
import SpecApiPanel from "./spec/SpecApiPanel";
import {
  SourceFormat,
  editorLanguageForSource,
  isSpecSourceFormat,
  parseCollectionFiles,
  parseSourceFormat,
} from "./sourceFormat";
import { hasPrimaryAction, invokePrimaryAction } from "./primaryAction";
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
type YamlPaneSizeSpec =
  | { kind: "percent"; value: number }
  | { kind: "px"; value: number }
  | { kind: "yaml" }
  | { kind: "ui" };

const minPanelSize = 420;
const defaultPanelRatio = 0.5;
const defaultYamlPaneSizeSpec: YamlPaneSizeSpec = { kind: "percent", value: 50 };

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

function parseYamlPaneSize(raw: unknown): YamlPaneSizeSpec {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return { kind: "percent", value: raw };
  }
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "only yaml" || text === "yaml") {
    return { kind: "yaml" };
  }
  if (text === "only ui" || text === "ui") {
    return { kind: "ui" };
  }
  const splitMatch = text.match(/^(\d+(?:\.\d+)?)\s*%\s*-\s*(\d+(?:\.\d+)?)\s*%$/);
  if (splitMatch) {
    return { kind: "percent", value: Number(splitMatch[1]) };
  }
  const pxMatch = text.match(/^(\d+(?:\.\d+)?)\s*px$/);
  if (pxMatch) {
    return { kind: "px", value: Number(pxMatch[1]) };
  }
  const percentMatch = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    return { kind: "percent", value: Number(percentMatch[1]) };
  }
  const bareMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (bareMatch) {
    return { kind: "percent", value: Number(bareMatch[1]) };
  }
  return defaultYamlPaneSizeSpec;
}

function splitSizeFromYamlSetting(width: number, spec: YamlPaneSizeSpec): number {
  if (spec.kind === "px") {
    if (!Number.isFinite(spec.value) || spec.value <= 0) {
      return defaultPanelSize("full", width);
    }
    return clampPanelSize(Math.round(spec.value), "full", width);
  }
  if (spec.kind === "percent") {
    if (!Number.isFinite(spec.value) || spec.value <= 0) {
      return defaultPanelSize("full", width);
    }
    return panelSizeFromRatio(spec.value / 100, width);
  }
  // Only YAML / Only UI: split button falls back to 50%-50%
  return panelSizeFromRatio(defaultPanelRatio, width);
}

const App: React.FC = () => {
  const splitHostRef = useRef<HTMLDivElement | null>(null);
  const initialWidth = typeof window !== "undefined" ? window.innerWidth : minPanelSize * 2;
  const [panelSize, setPanelSize] = useState(() => defaultPanelSize("full", initialWidth));
  const [panelMode, setPanelMode] = useState<PanelMode>("full");
  const panelSizeRef = useRef(defaultPanelSize("full", initialWidth));
  const lastFullPanelSizeRef = useRef(defaultPanelSize("full", initialWidth));
  const lastFullPanelRatioRef = useRef(defaultPanelRatio);
  const lastPanelDebugRef = useRef<{message: string; time: number} | null>(null);

  const [content, setContent] = useState("");
  const [validContent, setValidContent] = useState("");
  const [documentContentLoaded, setDocumentContentLoaded] = useState(false);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("mmt");
  const [mmtFilePath, setMmtFilePath] = useState<string | undefined>(undefined);
  const [projectRoot, setProjectRoot] = useState<string | undefined>(undefined);
  const [collectionFiles, setCollectionFiles] = useState<BrunoSourceFile[]>([]);
  const [collectionName, setCollectionName] = useState<string | undefined>(undefined);
  const [yamlFontSize, setYamlFontSize] = useState<number>(12);
  const [collapseDescription, setCollapseDescription] = useState<boolean>(false);
  const yamlPaneSizeRef = useRef<YamlPaneSizeSpec>(defaultYamlPaneSizeSpec);
  const configReadyRef = useRef(false);
  const pendingOpenLayoutRef = useRef(true);

  const isInitLoad = useRef(true);
  const [yamlEditorFocused, setYamlEditorFocused] = useState(false);
  const lastWindowWidthRef = useRef(window.innerWidth);

  function applyConfiguredSplit(width: number) {
    const size = splitSizeFromYamlSetting(width, yamlPaneSizeRef.current);
    setPanelMode("full");
    lastFullPanelRatioRef.current = clampPanelRatio(size / width, width);
    lastFullPanelSizeRef.current = size;
    setPanelSize(size);
  }

  function applyOpenLayout(width = getLayoutWidth()) {
    const spec = yamlPaneSizeRef.current;
    if (spec.kind === "yaml") {
      setPanelMode("yaml");
      setPanelSize(defaultPanelSize("yaml", width));
    } else if (spec.kind === "ui") {
      setPanelMode("ui");
      setPanelSize(defaultPanelSize("ui", width));
    } else {
      applyConfiguredSplit(width);
    }
    lastWindowWidthRef.current = window.innerWidth;
  }

  function tryApplyOpenLayout() {
    if (!pendingOpenLayoutRef.current || !configReadyRef.current) {
      return;
    }
    applyOpenLayout();
    pendingOpenLayoutRef.current = false;
  }

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
      if (isBrunoCollectionFilePath(mmtFilePath || "")) {
        setValidContent(content);
        return;
      }
      const parsed = parseBrunoDocument(content);
      if (parsed.blocks.length > 0) {
        setValidContent(content);
      }
      return;
    }
    if (isSpecSourceFormat(sourceFormat)) {
      setValidContent(content);
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
        // Apply before panels mount so telescope / resolveApiRequest see c:git_*.
        applyViewDocumentGitSnapshot(message);
        setDocumentContentLoaded(true);
        pendingOpenLayoutRef.current = true;
        tryApplyOpenLayout();
        const nextSourceFormat = parseSourceFormat(
          message.sourceFormat === "http" || isHttpFilePath(message.uri || "") ? "http" :
            message.sourceFormat === "bruno" || isBrunoFilePath(message.uri || "") || isBrunoCollectionFilePath(message.uri || "") ? "bruno" :
              message.sourceFormat
        );
        setSourceFormat(nextSourceFormat);
        const loadedText = toEditorText(message.content);
        setContent(prev => {
          if (prev === loadedText) {
            return prev;
          }
          // Skip echoing the loaded text back; an unchanged value would never
          // consume this flag and would swallow the user's first edit.
          isInitLoad.current = true;
          return loadedText;
        });

        // Only seed validContent if the initial document is valid;
        // otherwise leave it as-is (so UI doesn't see "{}" or "")
        if (nextSourceFormat === "http") {
          const parsed = parseHttpDocument(message.content);
          if (parsed.requests.length > 0) {
            setValidContent(toEditorText(message.content));
          }
        } else if (nextSourceFormat === "bruno") {
          if (isBrunoCollectionFilePath(message.uri || "") ||
              (Array.isArray(message.collectionFiles) && message.collectionFiles.length > 0)) {
            setValidContent(toEditorText(message.content));
          } else {
            const parsed = parseBrunoDocument(message.content);
            if (parsed.blocks.length > 0) {
              setValidContent(toEditorText(message.content));
            }
          }
        } else if (isSpecSourceFormat(nextSourceFormat)) {
          setValidContent(toEditorText(message.content));
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
        if (nextSourceFormat === "bruno") {
          setCollectionFiles(parseCollectionFiles(message.collectionFiles));
          setCollectionName(typeof message.collectionName === "string" ? message.collectionName : undefined);
        } else {
          setCollectionFiles([]);
          setCollectionName(undefined);
        }
      }

      // External document change (undo / revert) – update content without
      // echoing an updateDocumentContent message back to the extension.
      if (message.command === "documentContentChanged") {
        const nextSourceFormat = parseSourceFormat(
          message.sourceFormat === "http" || isHttpFilePath(message.uri || mmtFilePath || "") ? "http" :
            message.sourceFormat === "bruno" || isBrunoFilePath(message.uri || mmtFilePath || "") ||
              isBrunoCollectionFilePath(message.uri || mmtFilePath || "") ? "bruno" :
              message.sourceFormat,
          sourceFormat
        );
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
          if (isBrunoCollectionFilePath(message.uri || mmtFilePath || "") ||
              (Array.isArray(message.collectionFiles) && message.collectionFiles.length > 0)) {
            setValidContent(editorText);
          } else {
            const parsed = parseBrunoDocument(editorText);
            if (parsed.blocks.length > 0) {
              setValidContent(editorText);
            }
          }
        } else if (isSpecSourceFormat(nextSourceFormat)) {
          setValidContent(editorText);
        } else {
          try {
            if (isUsableMmtYaml(editorText)) {
              setValidContent(editorText);
            }
          } catch {
            // keep previous validContent
          }
        }
        if (nextSourceFormat === "bruno" && message.collectionFiles) {
          setCollectionFiles(parseCollectionFiles(message.collectionFiles));
          setCollectionName(typeof message.collectionName === "string" ? message.collectionName : undefined);
        }
      }

      if (message.command === "sendRequest") {
        invokePrimaryAction();
      }

      if (message.command === "multimeter.mmt.show.panel") {
        const width = getLayoutWidth();
        if (message.panelId === "full") {
          applyConfiguredSplit(width);
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
          cacheBodyAutoFormat(message.bodyAutoFormat);
        }
        if (typeof message.bodyLineNumbers === "boolean") {
          cacheBodyLineNumbers(message.bodyLineNumbers);
        }
        if (typeof message.reportSpillBytes === "number" && message.reportSpillBytes >= 0) {
          cacheReportSpillBytes(message.reportSpillBytes);
        }
        if (
          typeof message.bodyAutoFormat === "boolean"
          || typeof message.bodyLineNumbers === "boolean"
          || typeof message.reportSpillBytes === "number"
        ) {
          window.dispatchEvent(new CustomEvent("multimeter.config", { detail: message }));
        }
        const size = Number(message.editorFontSize);
        if (Number.isFinite(size) && size > 0) {
          setYamlFontSize(size);
        } else {
          setYamlFontSize(12);
        }
        yamlPaneSizeRef.current = parseYamlPaneSize(message.yamlPaneSize);
        configReadyRef.current = true;
        // Open layout uses settings once; later config broadcasts only refresh refs
        // (split button / next file open apply them). Avoid live rebinding the sash.
        tryApplyOpenLayout();
        if (typeof message.collapseDescription === "boolean") {
          setCollapseDescription(message.collapseDescription);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  // tryApplyOpenLayout only gates on refs; listing it would rebind this listener every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContent, mmtFilePath, sourceFormat]);

  const docType = useMemo(() => {
    if (isSpecSourceFormat(sourceFormat)) {
      return validContent.trim() ? "spec" : null;
    }
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

  const yamlErrors = useMemo(() => {
    if (sourceFormat !== "mmt") {
      return [];
    }
    return collectYamlEditorErrors(content);
  }, [content, sourceFormat]);

  const yamlStale = sourceFormat === "mmt" && content !== validContent && yamlErrors.length > 0;

  const [yamlErrorDimDismissed, setYamlErrorDimDismissed] = useState(false);

  useEffect(() => {
    if (yamlErrors.length === 0) {
      setYamlErrorDimDismissed(false);
    }
  }, [yamlErrors.length]);

  const restoreValidYaml = useCallback(() => {
    setContent(validContent);
    setYamlErrorDimDismissed(false);
  }, [validContent]);

  const dismissYamlErrorDim = useCallback(() => {
    setYamlErrorDimDismissed(true);
  }, []);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (!hasPrimaryAction()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      invokePrimaryAction();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    panelSizeRef.current = panelSize;
    if (panelMode !== "full") {
      return;
    }
    const width = getLayoutWidth();
    if (!isUsableLayoutWidth(width)) {
      return;
    }
    lastFullPanelSizeRef.current = panelSize;
    lastFullPanelRatioRef.current = clampPanelRatio(panelSize / width, width);
  }, [panelMode, panelSize]);

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

  // panelMode owns visibility; panelSize is only the split ratio in "full".
  // Keep SplitPane + Monaco mounted. Hide inactive pane + resizer completely —
  // size 0/100% alone left a sash/gap (resizer margins; UI minWidth).
  const isSplitMode = panelMode === "full";
  const layoutWidth = getLayoutWidth();

  const pane1Style: React.CSSProperties =
    panelMode === "ui"
      ? { display: "none" }
      : panelMode === "yaml"
        ? { flex: "1 1 auto", width: "100%", minWidth: 0, overflow: "hidden" }
        : { minWidth: 0, overflow: "hidden" };

  const pane2Style: React.CSSProperties =
    panelMode === "yaml"
      ? { display: "none" }
      : panelMode === "ui"
        ? { flex: "1 1 auto", width: "100%", minWidth: 0, overflow: "hidden" }
        : { minWidth: 0, overflow: "hidden" };

  const resizerStyle: React.CSSProperties | undefined = isSplitMode
    ? undefined
    : { display: "none", width: 0, minWidth: 0, margin: 0, padding: 0, pointerEvents: "none" };

  return (
    <FileContext.Provider value={{
      mmtFilePath,
      projectRoot,
      yamlErrors,
      yamlStale,
      restoreValidYaml,
      yamlErrorDimDismissed,
      dismissYamlErrorDim,
      collectionFiles,
      collectionName,
    }}>
      <div ref={splitHostRef} className="split-host">
        <SplitPane
          split="vertical"
          size={panelSize}
          allowResize={isSplitMode}
          resizerClassName="Resizer"
          resizerStyle={resizerStyle}
          onChange={(size) => {
            if (!isSplitMode) {
              return;
            }
            const width = getLayoutWidth();
            if (!isLayoutVisible(width)) {
              debugPanelState(`ignore split change while hidden/narrow width=${width} mode=${panelMode} size=${size}`);
              return;
            }
            lastFullPanelRatioRef.current = clampPanelRatio(size / width, width);
            setPanelSize(size);
          }}
          minSize={isSplitMode ? minPanelSize : 0}
          maxSize={isSplitMode ? Math.max(layoutWidth - minPanelSize, minPanelSize) : layoutWidth}
          pane1Style={pane1Style}
          pane2Style={pane2Style}
          className="mmt-split"
        >
          <div data-mmt-coach="yaml" className="pane-clip">
            <YamlEditorPanel
              content={content}
              setContent={yamlSetContent}
              onFocusChange={setYamlEditorFocused}
              fontSize={yamlFontSize}
              collapseDescription={collapseDescription}
              language={editorLanguageForSource(sourceFormat, mmtFilePath)}
              sourceFormat={sourceFormat}
            />
          </div>
          <div
            className={["mmt-ui-panel", "pane-clip", yamlErrors.length > 0 ? "mmt-yaml-error" : undefined].filter(Boolean).join(" ") || undefined}
          >
            {yamlErrors.length > 0 && !docType && (
              <div className="yaml-error-fallback">
                <YamlErrorWarning />
              </div>
            )}
            <div
              className="ui-pane-inner"
              style={isSplitMode ? { minWidth: 450 } : undefined}
            >
              <YamlErrorDim />
              <PanelErrorBoundary resetKey={`${docType || "none"}::${validContent}`}>
                {docType === "env" && (
                  <EnvironmentPanel content={validContent} setContent={uiSetContent} />
                )}
                {docType === "spec" && (
                  <SpecApiPanel content={validContent} />
                )}
                {docType === "api" && (
                  <APIPanel content={validContent} setContent={uiSetContent} />
                )}
                {docType === "doc" && (
                  <DocPanel content={validContent} setContent={uiSetContent} />
                )}
                {docType === "test" && (
                  sourceFormat === "http" ?
                    <HttpPanel content={validContent} setContent={uiSetContent} /> :
                    sourceFormat === "bruno" ?
                    <BrunoPanel content={validContent} setContent={uiSetContent} /> :
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
                {docType === "judge" && (
                  <JudgePanel content={validContent} setContent={uiSetContent} />
                )}
                {docType === "report" && (
                  <ReportPanel content={validContent} />
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