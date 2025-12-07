import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import { yamlToAPI } from "mmt-core/apiParsePack";
import TextEditor from "../text/TextEditor";
import { handleBeforeMount } from "./BeforeMount";
import { safeList } from "mmt-core/safer";
import { openRelativeFile, showVSCodeMessage, showHistoryPanel } from "../vsAPI";
import { FileContext } from "../fileContext";
import { runApiDocument } from "../api/useAPITesterLogic";

interface YamlEditorPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
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
  const { filePath } = useContext(FileContext);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const linkDecorationsRef = useRef<string[]>([]);
  const runGlyphDecorationsRef = useRef<string[]>([]);
  const exampleRunDecorationsRef = useRef<string[]>([]);
  const exampleRunInfoRef = useRef<{ line: number; index: number; name?: string }[]>([]);
  const [editorReady, setEditorReady] = useState(false);
  const importsMapRef = useRef<Record<string, string>>({});
  const ctrlDownRef = useRef<boolean>(false);
  const [runButtonEnabled, setRunButtonEnabled] = useState(true);
  const [docType, setDocType] = useState<string | null>(null);
  const shouldShowRunControls = runButtonEnabled && (docType === "test" || docType === "api");

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
        }
        setEditorErrorMarker(monaco, editor, markers);
      } else {
        monaco.editor.setModelMarkers(model, "yaml", []);
      }
    } catch (e: any) {
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
    } catch {
      importsMapRef.current = {};
      setDocType(null);
    }
  }, [content]);

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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.command === "config" && typeof message.showRunButton === "boolean") {
        setRunButtonEnabled(message.showRunButton);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const toggleRunButton = useCallback(() => {
    const next = !runButtonEnabled;
    setRunButtonEnabled(next);
    window.vscode?.postMessage({
      command: "updateConfig",
      fullKey: "multimeter.mmtEditor.showRunButton",
      value: next,
    });
  }, [runButtonEnabled]);

  const handleRunClick = useCallback(async () => {
    try {
      if (docType === "api") {
        showHistoryPanel();
        const delay = (ms: number) =>
          new Promise<void>(resolve => setTimeout(resolve, ms));
        await delay(200);

        const apiData = yamlToAPI(content);
        await runApiDocument({ api: apiData, filePath });
      } else {
        window.vscode?.postMessage({ command: "runCurrentDocument" });
      }
    } catch (err: any) {
      showVSCodeMessage("error", err?.message || "Failed to run document.");
    }
  }, [docType, content, filePath]);

  const handleRunExample = useCallback(async (exampleIndex: number) => {
    try {
      const apiData = yamlToAPI(content);
      const examplesList = safeList(apiData?.examples);
      const example = examplesList[exampleIndex];
      if (!example) {
        showVSCodeMessage("warn", "Selected example was not found in this document.");
        return;
      }

      showHistoryPanel();
      await new Promise<void>(resolve => setTimeout(resolve, 200));

      const exampleInputs = (example && typeof example === "object" && example.inputs && typeof example.inputs === "object")
        ? example.inputs
        : (example as any)?.inputs || {};

      await runApiDocument({ api: apiData, inputs: exampleInputs, filePath });
    } catch (err: any) {
      showVSCodeMessage("error", err?.message || "Failed to run example.");
    }
  }, [content, filePath]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const editor = editorRef.current;
    if (!shouldShowRunControls || !editorReady) {
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
    }
  }, [shouldShowRunControls, editorReady]);

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
          range: new monaco.Range(1, 1, 1, 1),
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
  }, [editorReady, shouldShowRunControls]);

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

    exampleRunInfoRef.current = positions.map(info => ({
      line: info.line,
      index: info.index,
      name: examplesList[info.index]?.name,
    }));

    exampleRunDecorationsRef.current = editor.deltaDecorations(
      exampleRunDecorationsRef.current,
      positions.map(info => {
        const name = examplesList[info.index]?.name;
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

      if (lineNumber === 1) {
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
        onToggleRunButton={(docType === "test" || docType === "api") ? toggleRunButton : undefined}
        showGlyphMargin={shouldShowRunControls}
      />
    </div>
  );
};

export default YamlEditorPanel;


type ExampleLineInfo = { line: number; index: number };

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