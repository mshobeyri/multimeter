import React, { useEffect, useRef, useState } from "react";
import parseYaml, { parseYamlDoc } from "mmt-core/markupConvertor";
import TextEditor from "../text/TextEditor";
import { handleBeforeMount } from "./BeforeMount";
import { safeList } from "mmt-core/safer";
import { openRelativeFile } from "../vsAPI";
import { loadEnvVariables } from "../workspaceStorage";
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
  findTestCallInputsProblems,
  getUndefinedInputDecorations,
  getUndefinedExampleKeyDecorations,
  findExampleKeyProblems,
  getUndefinedInputRefDecorations,
  findInputRefProblems,
  getUndefinedEnvRefDecorations,
  findEnvRefProblems,
  findMultilineDescriptionProblems,
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
  collapseDescription?: boolean;
  onFocusChange?: (focused: boolean) => void; // <-- add this
}

/**
 * Find 1-based line numbers of multi-line description blocks that should
 * be auto-folded.  A description counts as "multi-line" when the
 * `description:` key is followed by at least one indented continuation
 * line (block-scalar `|`/`>` with 2+ content lines, or a plain/quoted
 * value that wraps to the next line).
 */
function getDescriptionFoldLines(model: any): number[] {
  const lines: string[] = model.getLinesContent();
  const result: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (!/^description:(\s|$)/.test(trimmed)) {
      continue;
    }

    const descIndent = lines[i].search(/\S/);
    const afterColon = trimmed.slice('description:'.length).trim();
    const isBlockScalar = /^[|>]/.test(afterColon);

    // Count continuation lines that are indented deeper than the key
    let continuationCount = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine.trim() === '') {
        // Blank lines are part of the block only if more indented
        // content follows
        let hasMore = false;
        for (let k = j + 1; k < lines.length; k++) {
          if (lines[k].trim() === '') {
            continue;
          }
          hasMore = lines[k].search(/\S/) > descIndent;
          break;
        }
        if (hasMore) {
          continuationCount++;
          continue;
        }
        break;
      }
      if (nextLine.search(/\S/) > descIndent) {
        continuationCount++;
      } else {
        break;
      }
    }

    // Block scalars (| / >) need 2+ content lines to qualify as
    // "more than one line".  Inline values need just 1 continuation.
    const threshold = isBlockScalar ? 2 : 1;
    if (continuationCount >= threshold) {
      result.push(i + 1); // 1-based
    }
  }

  return result;
}

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";
const UNDEFINED_INPUT_CLASS = "mmt-undefined-input-underline";
const EXPECT_OP_CLASS = "mmt-expect-operator";

/** Known comparison operators, longest first so >= matches before > */
const EXPECT_OPS = ['==', '!=', '>=', '<=', '=@', '!@', '=~', '!~', '=^', '!^', '=$', '!$', '>', '<'];

const YamlEditorPanel: React.FC<YamlEditorPanelProps> = ({
  content,
  setContent,
  onFocusChange, // <-- receive it as a prop
  fontSize,
  collapseDescription
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const linkDecorationsRef = useRef<string[]>([]);
  const undefinedInputDecorationsRef = useRef<string[]>([]);
  const undefinedExampleKeyDecorationsRef = useRef<string[]>([]);
  const undefinedInputRefDecorationsRef = useRef<string[]>([]);
  const undefinedEnvRefDecorationsRef = useRef<string[]>([]);
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
  const [exampleKeyProblems, setExampleKeyProblems] = useState<ProblemEntry[]>([]);
  const [inputRefProblems, setInputRefProblems] = useState<ProblemEntry[]>([]);
  const [envRefProblems, setEnvRefProblems] = useState<ProblemEntry[]>([]);
  const [descriptionProblems, setDescriptionProblems] = useState<ProblemEntry[]>([]);
  const [knownEnvNames, setKnownEnvNames] = useState<Set<string>>(new Set());
  // Keep track of whether the editor has detected a canonical key-order issue via markers.
  const shouldShowRunControls = (docType === "test" || docType === "api" || docType === "suite");

  // Load environment variable names and listen for refresh events
  useEffect(() => {
    const refreshEnv = () => {
      const cleanup = loadEnvVariables((variables) => {
        setKnownEnvNames(new Set(variables.map((v) => v.name)));
      });
      return cleanup;
    };

    let envCleanup = refreshEnv();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.command === 'multimeter.environment.refresh') {
        if (envCleanup) {
          envCleanup();
        }
        envCleanup = refreshEnv();
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (envCleanup) {
        envCleanup();
      }
    };
  }, []);

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

  // Auto-fold multi-line description blocks on initial document load
  // so they don't visually distract the user.
  useEffect(() => {
    if (!collapseDescription || !editorReady || !editorRef.current) {
      return;
    }
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    // The indentation-based folding model needs a moment to initialise
    // after the editor is mounted and content is set.
    const timer = setTimeout(() => {
      const foldLines = getDescriptionFoldLines(model);
      if (foldLines.length > 0) {
        editor.trigger('auto-fold-descriptions', 'editor.fold', {
          selectionLines: foldLines,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [editorReady, collapseDescription]);

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
        setCallInputsProblems([]);
        undefinedInputDecorationsRef.current = editor.deltaDecorations(undefinedInputDecorationsRef.current, []);
        return;
      }
    } catch {
      monaco.editor.setModelMarkers(model, "mmt-call", []);
      setCallAliasProblems([]);
      setCallInputsProblems([]);
      undefinedInputDecorationsRef.current = editor.deltaDecorations(undefinedInputDecorationsRef.current, []);
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

    const inputProblems = findTestCallInputsProblems(
      content,
      doc,
      docType,
      apiInputsByAlias
    );
    setCallInputsProblems(inputProblems);

    const undefinedInputDecos = getUndefinedInputDecorations(
      monaco,
      model,
      content,
      doc,
      docType,
      apiInputsByAlias,
      UNDEFINED_INPUT_CLASS
    );
    undefinedInputDecorationsRef.current = editor.deltaDecorations(
      undefinedInputDecorationsRef.current,
      undefinedInputDecos
    );
  }, [content, docType, editorReady, apiInputsByAlias]);

  // Warn on example input/output keys that don't match API-level inputs/outputs
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
        setExampleKeyProblems([]);
        undefinedExampleKeyDecorationsRef.current = editor.deltaDecorations(undefinedExampleKeyDecorationsRef.current, []);
        return;
      }
    } catch {
      setExampleKeyProblems([]);
      undefinedExampleKeyDecorationsRef.current = editor.deltaDecorations(undefinedExampleKeyDecorationsRef.current, []);
      return;
    }

    const problems = findExampleKeyProblems(content, doc, docType);
    setExampleKeyProblems(problems);

    const decos = getUndefinedExampleKeyDecorations(
      monaco,
      model,
      content,
      doc,
      docType,
      UNDEFINED_INPUT_CLASS
    );
    undefinedExampleKeyDecorationsRef.current = editor.deltaDecorations(
      undefinedExampleKeyDecorationsRef.current,
      decos
    );
  }, [content, docType, editorReady]);

  // Warn on i:xxx / <<i:xxx>> references to undefined inputs
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
        setInputRefProblems([]);
        undefinedInputRefDecorationsRef.current = editor.deltaDecorations(undefinedInputRefDecorationsRef.current, []);
        return;
      }
    } catch {
      setInputRefProblems([]);
      undefinedInputRefDecorationsRef.current = editor.deltaDecorations(undefinedInputRefDecorationsRef.current, []);
      return;
    }

    const problems = findInputRefProblems(content, doc, docType);
    setInputRefProblems(problems);

    const decos = getUndefinedInputRefDecorations(
      monaco,
      model,
      content,
      doc,
      docType,
      UNDEFINED_INPUT_CLASS
    );
    undefinedInputRefDecorationsRef.current = editor.deltaDecorations(
      undefinedInputRefDecorationsRef.current,
      decos
    );
  }, [content, docType, editorReady]);

  // Warn on multiline description without block-scalar indicator
  useEffect(() => {
    if (!editorReady || !monacoRef.current || !editorRef.current) {
      setDescriptionProblems([]);
      return;
    }
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      setDescriptionProblems([]);
      return;
    }

    const problems = findMultilineDescriptionProblems(content);
    setDescriptionProblems(problems);

    const markers = problems.map((p) => {
      const lineNumber = Math.min(Math.max(p.line ?? 1, 1), model.getLineCount());
      return {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber),
        message: p.message,
        severity: monaco.MarkerSeverity.Warning,
      };
    });
    monaco.editor.setModelMarkers(model, "mmt-description", markers);
  }, [content, editorReady]);

  // Warn on e:xxx / <<e:xxx>> references to undefined environment variables
  useEffect(() => {
    if (!editorReady || !monacoRef.current || !editorRef.current) {
      return;
    }
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model || knownEnvNames.size === 0) {
      setEnvRefProblems([]);
      undefinedEnvRefDecorationsRef.current = editor.deltaDecorations(undefinedEnvRefDecorationsRef.current, []);
      return;
    }

    const problems = findEnvRefProblems(content, knownEnvNames);
    setEnvRefProblems(problems);

    const decos = getUndefinedEnvRefDecorations(
      monaco,
      model,
      content,
      knownEnvNames,
      UNDEFINED_INPUT_CLASS
    );
    undefinedEnvRefDecorationsRef.current = editor.deltaDecorations(
      undefinedEnvRefDecorationsRef.current,
      decos
    );
  }, [content, editorReady, knownEnvNames]);

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

    // Highlight comparison operators inside expect: blocks (red colour)
    {
      const lines: string[] = model.getLinesContent();
      let inExpect = false;
      let expectIndent = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        if (trimmed === '') { continue; }

        const indent = line.length - trimmed.length;

        // Detect `expect:` header (block form, nothing after the colon)
        if (/^\s*expect:\s*$/.test(line)) {
          inExpect = true;
          expectIndent = indent;
          continue;
        }

        if (inExpect) {
          if (indent <= expectIndent) {
            inExpect = false;
            // fall through — this line is outside the block
          } else {
            // Inside expect block — look for a leading operator in the value.
            // Map entry:   key: ["]OP ...["]
            // Array item:  - ["]OP ...["]
            let valueStartCol = -1;
            const mapMatch = line.match(/^(\s*[\w.]+:\s+)/);
            if (mapMatch) {
              valueStartCol = mapMatch[1].length;
            }
            if (valueStartCol < 0) {
              const arrMatch = line.match(/^(\s*-\s+)/);
              if (arrMatch) {
                valueStartCol = arrMatch[1].length;
              }
            }

            if (valueStartCol >= 0 && valueStartCol < line.length) {
              let opStartCol = valueStartCol;
              const rest = line.slice(valueStartCol);

              // Skip opening quote if value is quoted
              let afterQuote = rest;
              if (rest[0] === '"' || rest[0] === "'") {
                afterQuote = rest.slice(1);
                opStartCol += 1;
              }

              for (const op of EXPECT_OPS) {
                if (
                  afterQuote.startsWith(op + ' ') ||
                  afterQuote === op ||
                  afterQuote.startsWith(op + '"') ||
                  afterQuote.startsWith(op + "'")
                ) {
                  matches.push({
                    range: new monaco.Range(
                      i + 1, opStartCol + 1,
                      i + 1, opStartCol + op.length + 1
                    ),
                    options: { inlineClassName: EXPECT_OP_CLASS }
                  });
                  break;
                }
              }
            }
            continue;
          }
        }
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
      ...exampleKeyProblems,
      ...inputRefProblems,
      ...envRefProblems,
      ...descriptionProblems,
    ];
    window.vscode.postMessage({
      command: "updateDocumentProblems",
      problems,
    });
  }, [docType, yamlProblems, orderingProblems, missingImportProblems, callAliasProblems, callInputsProblems, missingSuiteFileProblems, missingDocFileProblems, exampleKeyProblems, inputRefProblems, envRefProblems, descriptionProblems]);

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