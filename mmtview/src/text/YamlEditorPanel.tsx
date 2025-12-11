import React, { useCallback, useEffect, useRef, useState } from "react";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import { apiToYaml, yamlToAPI } from "mmt-core/apiParsePack";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import { yamlToDoc, docToYaml } from "mmt-core/docParsePack";
import TextEditor from "../text/TextEditor";
import { handleBeforeMount } from "./BeforeMount";
import { safeList } from "mmt-core/safer";
import { openRelativeFile, showVSCodeMessage } from "../vsAPI";

interface YamlEditorPanelProps {
  content: string;
  setContent: (value: string) => void;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number;
  onFocusChange?: (focused: boolean) => void; // <-- add this
}

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";

const YamlEditorPanel: React.FC<YamlEditorPanelProps> = ({
  content,
  setContent,
  onFocusChange // <-- receive it as a prop
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const linkDecorationsRef = useRef<string[]>([]);
  const runGlyphDecorationsRef = useRef<string[]>([]);
  const exampleRunDecorationsRef = useRef<string[]>([]);
  const exampleRunInfoRef = useRef<{ line: number; index: number; name?: string }[]>([]);
  const runGlyphLineRef = useRef<number>(1);
  const contentRef = useRef(content);
  const [editorReady, setEditorReady] = useState(false);
  const importsMapRef = useRef<Record<string, string>>({});
  const ctrlDownRef = useRef<boolean>(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [importsVersion, setImportsVersion] = useState(0);
  const lastImportsSignatureRef = useRef<string>("");
  const pendingImportValidationIdRef = useRef<number>(0);
  const [missingImports, setMissingImports] = useState<MissingImportEntry[]>([]);
  const [yamlProblems, setYamlProblems] = useState<ProblemEntry[]>([]);
  const [orderingProblems, setOrderingProblems] = useState<ProblemEntry[]>([]);
  const [missingImportProblems, setMissingImportProblems] = useState<ProblemEntry[]>([]);
  // Keep track of whether the editor has detected a canonical key-order issue via markers.
  const shouldShowRunControls = (docType === "test" || docType === "api");

  const reorderDocument = useCallback(() => {
    if (!docType) {
      showVSCodeMessage("warn", "Unknown document type. Cannot reorder items.");
      return;
    }
    const currentContent = contentRef.current ?? "";
    const reordered = buildCanonicalYaml(currentContent, docType);
    if (!reordered) {
      showVSCodeMessage("warn", "Unable to reorder items for this document.");
      return;
    }
    if (normalizeForComparison(reordered) === normalizeForComparison(currentContent)) {
      showVSCodeMessage("info", "Document already follows the canonical order.");
      return;
    }
    setContent(reordered);
  }, [docType, setContent]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }
      if (message.command === "importValidationResult") {
        if (message.requestId && message.requestId !== pendingImportValidationIdRef.current) {
          return;
        }
        const rawMissing = Array.isArray(message.missing) ? message.missing : [];
        const formatted: MissingImportEntry[] = rawMissing
          .filter((item: any) => item && typeof item.alias === "string" && typeof item.path === "string")
          .map((item: any) => ({ alias: item.alias, path: item.path }));
        setMissingImports(formatted);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  // Validate YAML and set error marker if invalid
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    try {
      const yamlDoc = parseYamlDoc(content);
      let markers = [];
      if (yamlDoc.errors && yamlDoc.errors.length > 0) {
        const problems: ProblemEntry[] = [];
        for (const error of yamlDoc.errors) {
          // Use linePos array for start/end
          const start = error.linePos?.[0];
          const end = error.linePos?.[1];
          markers.push({
            message: error.message,
            line: start ? start.line : 0,
            column: start ? start.col : 0,
            endColumn: end ? end.col + 1 : (start ? start.col + 2 : 2)
          });
          problems.push({
            message: error.message,
            severity: "error",
            line: start ? start.line : 1,
            column: start ? start.col : 1,
          });
        }
        setEditorErrorMarker(monaco, editor, markers);
        setYamlProblems(problems);
      } else {
        monaco.editor.setModelMarkers(model, "yaml", []);
        setYamlProblems([]);
      }
    } catch (e: any) {
      setYamlProblems([{
        message: "Failed to parse YAML document.",
        severity: "error",
      }]);
    }
  }, [content, editorReady]);

  // Parse imports map whenever content changes
  useEffect(() => {
    try {
      // Use plain YAML parse to get a JS object and read imports/import
      const js = parseYaml(content) as any;
      const imps = (js && (js.imports || js.import)) || {};
      importsMapRef.current = imps && typeof imps === 'object' ? imps : {};
      const typeVal = typeof js?.type === "string" ? js.type.toLowerCase() : null;
      setDocType(typeVal);
      const sortedEntries = Object.entries(importsMapRef.current)
        .filter(([, value]) => typeof value === "string")
        .sort(([a], [b]) => a.localeCompare(b));
      const nextSignature = JSON.stringify(sortedEntries);
      if (nextSignature !== lastImportsSignatureRef.current) {
        lastImportsSignatureRef.current = nextSignature;
        setImportsVersion((prev) => prev + 1);
      }
    } catch {
      importsMapRef.current = {};
      setDocType(null);
      if (lastImportsSignatureRef.current !== "[]") {
        lastImportsSignatureRef.current = "[]";
        setImportsVersion((prev) => prev + 1);
      }
    }
  }, [content]);

  useEffect(() => {
    const importsObj = importsMapRef.current || {};
    if (!importsObj || Object.keys(importsObj).length === 0) {
      setMissingImports([]);
      return;
    }
    if (!window?.vscode) {
      return;
    }
    const requestId = Date.now();
    pendingImportValidationIdRef.current = requestId;
    window.vscode.postMessage({
      command: "validateImports",
      imports: importsObj,
      requestId,
    });
  }, [importsVersion]);

  useEffect(() => {
    if (!editorReady || !monacoRef.current || !editorRef.current) {
      return;
    }
    const expectedOrder = getCanonicalOrder(docType);
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (!expectedOrder || !content.trim()) {
      monaco.editor.setModelMarkers(model, "yaml-ordering", []);
      setOrderingProblems([]);
      return;
    }

    try {
      const yamlDoc = parseYamlDoc(content);
      if (yamlDoc.errors && yamlDoc.errors.length > 0) {
        monaco.editor.setModelMarkers(model, "yaml-ordering", []);
        setOrderingProblems([]);
        return;
      }
      const issue = detectOrderingIssue(yamlDoc, content, expectedOrder);
      const markers = issue
        ? [{
          startLineNumber: issue.line,
          startColumn: 1,
          endLineNumber: issue.line,
          endColumn: model.getLineMaxColumn(issue.line),
          message: issue.message,
          severity: monaco.MarkerSeverity.Warning,
        }]
        : [];
      monaco.editor.setModelMarkers(model, "yaml-ordering", markers);
      if (issue) {
        setOrderingProblems([{ message: issue.message, severity: "warning", line: issue.line, column: 1 }]);
      } else {
        setOrderingProblems([]);
      }
    } catch {
      monaco.editor.setModelMarkers(model, "yaml-ordering", []);
      setOrderingProblems([]);
    }
  }, [content, docType, editorReady]);

  useEffect(() => {
    if (!editorReady || !monacoRef.current || !editorRef.current) {
      return;
    }
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (!missingImports.length) {
      monaco.editor.setModelMarkers(model, "mmt-imports", []);
      setMissingImportProblems([]);
      return;
    }

    let doc: any = null;
    try {
      doc = parseYamlDoc(content);
    } catch {
      monaco.editor.setModelMarkers(model, "mmt-imports", []);
      setMissingImportProblems([]);
      return;
    }

    const lineInfo = extractImportLineInfo(doc, content);
    const markers = missingImports.map(({ alias, path }) => {
      const info = lineInfo.find(entry => entry.alias === alias) || lineInfo.find(entry => entry.path === path);
      const targetLine = info?.line || 1;
      const lineNumber = Math.min(Math.max(targetLine, 1), model.getLineCount());
      return {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber),
        message: `Imported file "${path}" was not found.`,
        severity: monaco.MarkerSeverity.Warning,
      };
    });
    monaco.editor.setModelMarkers(model, "mmt-imports", markers);
    setMissingImportProblems(markers.map(marker => ({
      message: marker.message,
      severity: "warning",
      line: marker.startLineNumber,
      column: marker.startColumn,
    })));
  }, [missingImports, content, editorReady]);

  useEffect(() => {
    if (!editorReady || !editorRef.current || !monacoRef.current) {
      return;
    }
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const formatAction = editor.addAction({
      id: "mmt.reorderYaml.formatDocument",
      label: "Format Document",
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1,
      run: () => reorderDocument(),
    });

    return () => {
      formatAction.dispose();
    };
  }, [editorReady, reorderDocument]);

  // Ctrl/Cmd hover + click to open imported files or call names
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modifier = isMac ? 'metaKey' : 'ctrlKey';

    const getImportTargetAtPosition = (pos: any): { path: string; range: any } | null => {
      if (!pos) return null;

      const lineContent = model.getLineContent(pos.lineNumber);
      const aliasMatch = lineContent.match(/^[\s\t-]*['"]?([^'"\s:]+)['"]?\s*:/);
      if (!aliasMatch) return null;

      const alias = aliasMatch[1];
      const path = importsMapRef.current[alias];
      if (!path) return null;

      const colonIndex = lineContent.indexOf(':');
      if (colonIndex === -1) return null;

      const pathStartIdx = lineContent.indexOf(path, colonIndex + 1);
      if (pathStartIdx !== -1) {
        const startColumn = pathStartIdx + 1;
        const endColumn = startColumn + path.length;
        if (pos.column >= startColumn && pos.column <= endColumn) {
          return {
            path,
            range: new monaco.Range(pos.lineNumber, startColumn, pos.lineNumber, endColumn),
          };
        }
      }

      const word = model.getWordAtPosition(pos);
      if (!word) return null;
      if (word.word !== alias) return null;
      return {
        path,
        range: new monaco.Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn),
      };
    };

    const updateUnderline = (pos: any, withModifier: boolean) => {
      const target = withModifier ? getImportTargetAtPosition(pos) : null;
      linkDecorationsRef.current = editor.deltaDecorations(linkDecorationsRef.current, []);
      if (!target) return;
      linkDecorationsRef.current = editor.deltaDecorations(linkDecorationsRef.current, [{
        range: target.range,
        options: {
          inlineClassName: 'mmt-link-underline',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }]);
    };

    const onMouseMove = editor.onMouseMove((e: any) => {
      const evt = e.event?.browserEvent as MouseEvent | undefined;
      const pos = e.target?.position;
      if (!evt || !pos) return;
      const withMod = (evt as any)[modifier];
      updateUnderline(pos, withMod);
      const target = withMod ? getImportTargetAtPosition(pos) : null;
      editor.updateOptions({ mouseStyle: target ? 'pointer' : 'text' });
    });

    const onKeyDown = editor.onKeyDown((e: any) => {
      if ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) ctrlDownRef.current = true;
      const pos = editor.getPosition();
      if (pos) updateUnderline(pos, ctrlDownRef.current);
    });
    const onKeyUp = editor.onKeyUp((e: any) => {
      if (!(isMac ? e.metaKey : e.ctrlKey)) ctrlDownRef.current = false;
      linkDecorationsRef.current = editor.deltaDecorations(linkDecorationsRef.current, []);
      editor.updateOptions({ mouseStyle: 'text' });
    });

    const onMouseDown = editor.onMouseDown((e: any) => {
      const evt = e.event?.browserEvent as MouseEvent | undefined;
      const pos = e.target?.position;
      if (!evt || !pos) return;
      const withMod = (evt as any)[modifier];
      if (!withMod) return;
      const target = getImportTargetAtPosition(pos);
      if (target) {
        openRelativeFile(target.path);
      }
    });

    return () => {
      onMouseMove.dispose();
      onMouseDown.dispose();
      onKeyDown.dispose();
      onKeyUp.dispose();
      linkDecorationsRef.current = editor.deltaDecorations(linkDecorationsRef.current, []);
      editor.updateOptions({ mouseStyle: 'text' });
    };
  }, [content, editorReady]);

  const handleRunClick = () => {
    if (docType !== "test" && docType !== "api") {
      return;
    }
    try {
      window.vscode?.postMessage({
        command: "runCurrentDocument",
        inputs: {
          exampleIndex: -1,
        },
      });
    } catch (err: any) {
      showVSCodeMessage("error", err?.message || "Failed to run document.");
    }
  };

  const handleRunExample = (exampleIndex: number) => {
    try {
      const apiData = yamlToAPI(content);
      const examplesList = safeList(apiData?.examples);
      const example = examplesList[exampleIndex];
      if (!example) {
        showVSCodeMessage("warn", "Selected example was not found in this document.");
        return;
      }
      const exampleName = typeof example?.name === "string" && example.name.trim() ? example.name : undefined;
      window.vscode?.postMessage({
        command: "runCurrentDocument",
        inputs: { exampleIndex },
      });
    } catch (err: any) {
      showVSCodeMessage("error", err?.message || "Failed to run example.");
    }
  };

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const editor = editorRef.current;
    if (!shouldShowRunControls || !editorReady) {
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
    }
    // compute line of 'type' key or default to 1
    const doc = parseYamlDoc(content);
    const rootKeys = extractRootKeyInfo(doc, content);
    const typeKey = rootKeys.find(k => k.key === 'type');
    const runLine = (typeKey && typeKey.line) || 1;
    runGlyphLineRef.current = runLine;
  }, [shouldShowRunControls, editorReady, content]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const editor = editorRef.current;

    if (!shouldShowRunControls || !editorReady) {
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
      return;
    }

    const monaco = monacoRef.current;
    runGlyphDecorationsRef.current = editor.deltaDecorations(
      runGlyphDecorationsRef.current,
      [
        {
          range: new monaco.Range(runGlyphLineRef.current, 1, runGlyphLineRef.current, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: "mmt-run-glyph codicon codicon-run",
            glyphMarginHoverMessage: { value: "Run this MMT file" },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]
    );

    return () => {
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
    };
  }, [editorReady, shouldShowRunControls, content]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const editor = editorRef.current;

    if (!shouldShowRunControls || !editorReady || docType !== "api") {
      exampleRunInfoRef.current = [];
      exampleRunDecorationsRef.current = editor.deltaDecorations(
        exampleRunDecorationsRef.current,
        []
      );
      return;
    }

    const monaco = monacoRef.current;
    const doc = parseYamlDoc(content);
    const apiData = yamlToAPI(content);
    const examplesList = safeList(apiData?.examples);
    const positions = extractExampleLineInfo(doc, content).filter(info => info.line > 0);

    // Filter out examples with empty or missing names
    const filteredPositions = positions.filter(info => {
      const name = examplesList[info.index]?.name;
      return name && typeof name === 'string' && name.trim() !== '';
    });

    exampleRunInfoRef.current = filteredPositions.map(info => ({
      line: info.line,
      index: info.index,
      name: examplesList[info.index]?.name,
    }));

    exampleRunDecorationsRef.current = editor.deltaDecorations(
      exampleRunDecorationsRef.current,
      filteredPositions.map(info => {
        const example = examplesList[info.index];
        if (!example) { return; }
        const name = example?.name;
        const label = name ? `Run example: ${name}` : `Run example ${info.index + 1}`;
        return {
          range: new monaco.Range(info.line, 1, info.line, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: "mmt-run-glyph codicon codicon-run",
            glyphMarginHoverMessage: { value: label },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        };
      })
    );

    return () => {
      exampleRunInfoRef.current = [];
      exampleRunDecorationsRef.current = editor.deltaDecorations(
        exampleRunDecorationsRef.current,
        []
      );
    };
  }, [content, docType, editorReady, shouldShowRunControls]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const mouseDownDisposable = editor.onMouseDown((e: any) => {
      if (e.target?.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        return;
      }

      const lineNumber = e.target?.position?.lineNumber;
      if (!lineNumber) {
        return;
      }

      if (lineNumber === runGlyphLineRef.current) {
        e.event?.preventDefault?.();
        handleRunClick();
        return;
      }

      if (docType === "api") {
        const exampleInfo = exampleRunInfoRef.current.find(info => info.line === lineNumber);
        if (exampleInfo) {
          e.event?.preventDefault?.();
          void handleRunExample(exampleInfo.index);
        }
      }
    });

    return () => mouseDownDisposable.dispose();
  }, [handleRunClick, handleRunExample, docType]);

  // Effect to handle custom decorations
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const regex = [/[ieorc]:[a-zA-Z0-9_/-]+/g, /<<[ieorc]:[a-zA-Z0-9_/-]+>>/g];
    const value = model.getValue();
    const matches: any[] = [];
    let match;
    for (const re of regex) {
      while ((match = re.exec(value)) !== null) {
        const start = model.getPositionAt(match.index);
        const end = model.getPositionAt(match.index + match[0].length);
        matches.push({
          range: new monaco.Range(
            start.lineNumber,
            start.column,
            end.lineNumber,
            end.column
          ),
          options: { inlineClassName: I_PREFIX_CLASS }
        });
      }
    }
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      matches
    );
  }, [content, editorReady]);

  useEffect(() => {
    if (!window?.vscode) {
      return;
    }
    const problems = [...yamlProblems, ...orderingProblems, ...missingImportProblems];
    window.vscode.postMessage({
      command: "updateDocumentProblems",
      problems,
    });
  }, [yamlProblems, orderingProblems, missingImportProblems]);

  return (
    <div style={{ height: "100%" }}>
      <TextEditor
        language={"yaml"}
        content={content}
        setContent={setContent}
        beforeMount={handleBeforeMount}
        editorRef={editorRef}
        monacoRef={monacoRef}
        setEditorReady={setEditorReady}
        onFocusChange={onFocusChange}
        onToggleRunButton={handleRunClick}
        showGlyphMargin={true}
      />
    </div>
  );
};

export default YamlEditorPanel;


type ExampleLineInfo = { line: number; index: number };

type OrderingIssue = {
  line: number;
  key: string;
  prevKey?: string;
  message: string;
};

type RootKeyInfo = {
  key: string;
  line: number;
};

type MissingImportEntry = { alias: string; path: string };

type ImportLineInfo = {
  alias: string;
  path?: string;
  line: number;
};

type ProblemEntry = {
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
};

function extractExampleLineInfo(doc: any, content: string): ExampleLineInfo[] {
  if (!doc || !doc.contents) {
    return [];
  }

  const root: any = doc.contents;
  const rootItems: any[] = Array.isArray(root?.items) ? root.items : [];
  const examplesPair = rootItems.find(item => item?.key?.value === "examples");
  if (!examplesPair || !examplesPair.value) {
    return [];
  }

  const seqItems: any[] = Array.isArray(examplesPair.value?.items) ? examplesPair.value.items : [];
  const positions: ExampleLineInfo[] = [];

  seqItems.forEach((exampleNode, idx) => {
    let offset: number | undefined;
    if (Array.isArray(exampleNode?.range) && typeof exampleNode.range[0] === "number") {
      offset = exampleNode.range[0];
    } else if (exampleNode?.key && Array.isArray(exampleNode.key.range) && typeof exampleNode.key.range[0] === "number") {
      offset = exampleNode.key.range[0];
    }

    if (typeof offset === "number") {
      positions.push({
        line: offsetToLineNumber(content, offset),
        index: idx,
      });
    }
  });

  return positions;
}

function offsetToLineNumber(content: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }
  let line = 1;
  const limit = Math.min(offset, content.length);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function extractRootKeyInfo(doc: any, content: string): RootKeyInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  return items
    .map(item => {
      const key = item?.key?.value;
      if (typeof key !== "string" || !key.trim()) {
        return null;
      }
      const offset = Array.isArray(item?.key?.range) ? item.key.range[0] : Array.isArray(item?.range) ? item.range[0] : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { key, line } as RootKeyInfo;
    })
    .filter(Boolean) as RootKeyInfo[];
}

function extractImportLineInfo(doc: any, content: string): ImportLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const importPair = items.find(entry => {
    const key = entry?.key?.value;
    return key === "import" || key === "imports";
  });
  if (!importPair || !importPair.value) {
    return [];
  }
  const mapItems: any[] = Array.isArray(importPair.value.items) ? importPair.value.items : [];
  return mapItems
    .map(pair => {
      const alias = typeof pair?.key?.value === "string" ? pair.key.value : undefined;
      if (!alias) {
        return null;
      }
      const path = typeof pair?.value?.value === "string" ? pair.value.value : undefined;
      const offset = Array.isArray(pair?.value?.range) && typeof pair.value.range[0] === "number"
        ? pair.value.range[0]
        : Array.isArray(pair?.range) ? pair.range[0] : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { alias, path, line } as ImportLineInfo;
    })
    .filter(Boolean) as ImportLineInfo[];
}

function getCanonicalOrder(docType: string | null): string[] | null {
  switch (docType) {
    case "api":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "setenv",
        "url",
        "query",
        "protocol",
        "method",
        "format",
        "headers",
        "cookies",
        "body",
        "examples"
      ];
    case "test":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "metrics",
        "steps",
        "stages"
      ];
    case "doc":
      return ["type", "title", "description", "logo", "sources", "services"];
    default:
      return null;
  }
}

function detectOrderingIssue(doc: any, content: string, expectedOrder: string[]): OrderingIssue | null {
  const orderMap = new Map<string, number>();
  expectedOrder.forEach((key, idx) => orderMap.set(key, idx));
  const keys = extractRootKeyInfo(doc, content);
  let lastIdx = -1;
  let lastKey: string | undefined;
  for (const entry of keys) {
    if (!orderMap.has(entry.key)) {
      continue;
    }
    const currentIdx = orderMap.get(entry.key) ?? 0;
    if (currentIdx < lastIdx) {
      const message = lastKey
        ? `'${entry.key}' should appear before '${lastKey}' to follow the canonical order. Use Format Document (Shift+Alt+F) to fix it.`
        : `'${entry.key}' is out of order. Use Format Document (Shift+Alt+F) to fix it.`;
      return { line: entry.line, key: entry.key, prevKey: lastKey, message };
    }
    lastIdx = currentIdx;
    lastKey = entry.key;
  }
  return null;
}

function buildCanonicalYaml(content: string, docType: string | null): string | null {
  try {
    switch (docType) {
      case "api":
        return apiToYaml(yamlToAPI(content));
      case "test":
        return testToYaml(yamlToTest(content));
      case "doc":
        return docToYaml(yamlToDoc(content));
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+$/g, "").trim();
}


function setEditorErrorMarker(
  monaco: any,
  editor: any,
  errors: { message: string, line?: number, column?: number, endColumn?: number }[]
) {
  const model = editor.getModel();
  if (!model) return;

  const markers = safeList(errors).map(error => {
    const line = error.line && error.line > 0 ? error.line : 1;
    const column = error.column && error.column > 0 ? error.column : 1;
    const endColumn =
      error.endColumn && error.endColumn > column
        ? error.endColumn
        : model.getLineMaxColumn(line);

    return {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: endColumn,
      message: error.message,
      severity: monaco.MarkerSeverity.Error,
    };
  });

  monaco.editor.setModelMarkers(model, "yaml", markers);
}