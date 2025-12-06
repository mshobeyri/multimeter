import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import TextEditor from "../text/TextEditor";
import { handleBeforeMount } from "./BeforeMount";
import { safeList } from "mmt-core/safer";
import { openRelativeFile } from "../vsAPI";
import { FileContext } from "../fileContext";

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
  const [editorReady, setEditorReady] = useState(false);
  const importsMapRef = useRef<Record<string, string>>({});
  const ctrlDownRef = useRef<boolean>(false);
  const [runButtonEnabled, setRunButtonEnabled] = useState(true);
  const [docType, setDocType] = useState<string | null>(null);

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

  const handleRunClick = useCallback(() => {
    try {
      if (docType === "api") {
        window.postMessage({
          command: "multimeter.api.run",
          uri: filePath
        }, "*");
      } else {
        window.vscode?.postMessage({ command: "runCurrentDocument" });
      }
    } catch {
      // ignore
    }
  }, [docType, filePath]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const editor = editorRef.current;
    if (!runButtonEnabled || !editorReady || !(docType === "test" || docType === "api")) {
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
    }
  }, [runButtonEnabled, editorReady, docType]);

  useEffect(() => {
    if (!editorReady || !monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    if (!runButtonEnabled) {
      return;
    }

    if (!(docType === "test" || docType === "api")) {
      return;
    }

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

    const mouseDownDisposable = editor.onMouseDown((e: any) => {
      if (
        e.target?.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        e.target?.position?.lineNumber === 1
      ) {
        e.event?.preventDefault?.();
        handleRunClick();
      }
    });

    return () => {
      mouseDownDisposable.dispose();
      runGlyphDecorationsRef.current = editor.deltaDecorations(
        runGlyphDecorationsRef.current,
        []
      );
    };
  }, [editorReady, handleRunClick, runButtonEnabled, docType]);

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
      />
    </div>
  );
};

export default YamlEditorPanel;


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