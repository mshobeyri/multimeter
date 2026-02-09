import React, { useEffect, useRef, useState } from "react";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import TextEditor from "../text/TextEditor";
import { handleBeforeMount } from "./BeforeMount";
import { safeList } from "mmt-core/safer";
import { openRelativeFile } from "../vsAPI";
import { useImportValidation } from "./useImportValidation";
import { useDocFileValidation } from "./useDocFileValidation";
import { useSuiteTestsValidation } from "./useSuiteTestsValidation";
import { getFileLinkTargetAtPosition } from "./yamlLinks";
import {
  computeMissingImportMarkers,
  computeMissingDocFileMarkers, // Updated from computeMissingLogoFileMarkers
  computeMissingSuiteFileMarkers,
  computeOrderingMarkers,
  computeTestCallAliasMarkers,
  computeTestCallInputsMarkers,
  type ProblemEntry,
} from "./validator";
import { useRunGlyphs } from './useRunGlyphs';
import { useFormatAndOrder } from './useFormatAndOrder';
// formatting and ordering helper moved to `useFormatAndOrder`

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
  onFocusChange, // <-- receive it as a prop
  fontSize
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const linkDecorationsRef = useRef<string[]>([]);
  const contentRef = useRef(content);
  const [editorReady, setEditorReady] = useState(false);
  const importsMapRef = useRef<Record<string, string>>({});
  const ctrlDownRef = useRef<boolean>(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [importsMapState, setImportsMapState] = useState<Record<string, string>>({});
  const lastImportsSignatureRef = useRef<string>("");
  const { missingImports, inputsByAlias: apiInputsByAlias } = useImportValidation(importsMapState);
  const { missingSuiteFiles } = useSuiteTestsValidation(docType, content);
  const { missingDocFiles } = useDocFileValidation(docType, content); // Changed from missingLogoFile
  const [yamlProblems, setYamlProblems] = useState<ProblemEntry[]>([]);
  const [orderingProblems, setOrderingProblems] = useState<ProblemEntry[]>([]);
  const [missingImportProblems, setMissingImportProblems] = useState<ProblemEntry[]>([]);
  const [missingSuiteFileProblems, setMissingSuiteFileProblems] = useState<ProblemEntry[]>([]);
  const [missingDocFileProblems, setMissingDocFileProblems] = useState<ProblemEntry[]>([]); // Changed from missingLogoFileProblems
  const [callAliasProblems, setCallAliasProblems] = useState<ProblemEntry[]>([]);
  const [callInputsProblems, setCallInputsProblems] = useState<ProblemEntry[]>([]);
  // Keep track of whether the editor has detected a canonical key-order issue via markers.
  const shouldShowRunControls = (docType === "test" || docType === "api" || docType === "suite");

  const { handleRunClick } = useRunGlyphs({
    monacoRef,
    editorRef,
    content,
    editorReady,
    docType,
    shouldShowRunControls,
  });

  const { reorderDocument } = useFormatAndOrder({ contentRef, docType, setContent });



  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
        setImportsMapState({ ...importsMapRef.current });
      }
    } catch {
      importsMapRef.current = {};
      setDocType(null);
      if (lastImportsSignatureRef.current !== "[]") {
        lastImportsSignatureRef.current = "[]";
        setImportsMapState({});
      }
    }
  }, [content]);

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

    try {
      const yamlDoc = parseYamlDoc(content);
      if (yamlDoc.errors && yamlDoc.errors.length > 0) {
        monaco.editor.setModelMarkers(model, "yaml-ordering", []);
        setOrderingProblems([]);
        return;
      }

      const { markers, problems } = computeOrderingMarkers(monaco, model, content, yamlDoc, docType);
      monaco.editor.setModelMarkers(model, "yaml-ordering", markers);
      setOrderingProblems(problems);
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

    let doc: any = null;
    try {
      doc = parseYamlDoc(content);
    } catch {
      monaco.editor.setModelMarkers(model, "mmt-imports", []);
      setMissingImportProblems([]);
      return;
    }

    const { markers, problems } = computeMissingImportMarkers(monaco, model, content, doc, missingImports);
    monaco.editor.setModelMarkers(model, "mmt-imports", markers);
    setMissingImportProblems(problems);
  }, [missingImports, content, editorReady]);

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

    let doc: any = null;
    try {
      doc = parseYamlDoc(content);
    } catch {
      monaco.editor.setModelMarkers(model, "mmt-suite-files", []);
      setMissingSuiteFileProblems([]);
      return;
    }

    const { markers, problems } = computeMissingSuiteFileMarkers(monaco, model, content, doc, missingSuiteFiles);
    monaco.editor.setModelMarkers(model, "mmt-suite-files", markers);
    setMissingSuiteFileProblems(problems);
  }, [missingSuiteFiles, content, editorReady]);

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

    const { markers, problems } = computeMissingDocFileMarkers(monaco, model, missingDocFiles); // Changed from missingLogoFile
    monaco.editor.setModelMarkers(model, "mmt-logo-file", markers);
    setMissingDocFileProblems(problems); // Changed from setMissingLogoFileProblems
  }, [missingDocFiles, editorReady]); // Changed from missingLogoFile

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

    let doc: any = null;
    try {
      doc = parseYamlDoc(content);
      if (doc.errors && doc.errors.length > 0) {
        monaco.editor.setModelMarkers(model, "mmt-call", []);
        setCallAliasProblems([]);
        monaco.editor.setModelMarkers(model, "mmt-call-inputs", []);
        setCallInputsProblems([]);
        return;
      }
    } catch {
      monaco.editor.setModelMarkers(model, "mmt-call", []);
      setCallAliasProblems([]);
      monaco.editor.setModelMarkers(model, "mmt-call-inputs", []);
      setCallInputsProblems([]);
      return;
    }

    const { markers: aliasMarkers, problems: aliasProblems } = computeTestCallAliasMarkers(
      monaco,
      model,
      content,
      doc,
      importsMapRef.current,
      docType
    );
    monaco.editor.setModelMarkers(model, "mmt-call", aliasMarkers);
    setCallAliasProblems(aliasProblems);

    const { markers: inputMarkers, problems: inputProblems } = computeTestCallInputsMarkers(
      monaco,
      model,
      content,
      doc,
      docType,
      apiInputsByAlias
    );
    monaco.editor.setModelMarkers(model, "mmt-call-inputs", inputMarkers);
    setCallInputsProblems(inputProblems);
  }, [content, docType, editorReady, apiInputsByAlias]);

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

    const updateUnderline = (pos: any, withModifier: boolean) => {
      const target = withModifier
        ? getFileLinkTargetAtPosition(monaco, model, content, pos)
        : null;
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
      const target = withMod ? getFileLinkTargetAtPosition(monaco, model, content, pos) : null;
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
      const target = getFileLinkTargetAtPosition(monaco, model, content, pos);
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

  // run glyphs and example-run decorations handled in `useRunGlyphs` hook

  // Effect to handle custom decorations
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const matches: any[] = [];
    {
      const regex = [/<<[ieorc]:[a-zA-Z0-9_/-]+>>/g];
      const value = model.getValue();
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
    }
    {
      const regex = [/:\s[ieorc]:[a-zA-Z0-9_/-]+/g];
      const value = model.getValue();
      let match;
      for (const re of regex) {
        while ((match = re.exec(value)) !== null) {
          const start = model.getPositionAt(match.index);
          const end = model.getPositionAt(match.index + match[0].length);
          matches.push({
            range: new monaco.Range(
              start.lineNumber,
              start.column+2,
              end.lineNumber,
              end.column
            ),
            options: { inlineClassName: I_PREFIX_CLASS }
          });
        }
      }
    }
    {
      const regex = /\$\{[^}]+\}/g;
      const value = model.getValue();
      let match;
      while ((match = regex.exec(value)) !== null) {
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

    const problems = [
      ...yamlProblems,
      ...orderingProblems,
      ...missingImportProblems,
      ...callAliasProblems,
      ...callInputsProblems,
      ...missingSuiteFileProblems,
    ];
    window.vscode.postMessage({
      command: "updateDocumentProblems",
      problems,
    });
  }, [docType, yamlProblems, orderingProblems, missingImportProblems, callAliasProblems, callInputsProblems, missingSuiteFileProblems, missingDocFileProblems]);

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
        fontSize={fontSize}
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