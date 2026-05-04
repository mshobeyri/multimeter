import {yamlToAPI} from 'mmt-core/apiParsePack';
import {parseYamlDoc} from 'mmt-core/markupConvertor';
import {safeList} from 'mmt-core/safer';
import {useCallback, useEffect, useRef} from 'react';

import {showVSCodeMessage} from '../vsAPI';

import {extractRootKeyInfo, offsetToLineNumber} from './validator';

type ExampleInfo = {
  line: number; index: number;
  name?: string
};

export function useRunGlyphs(params: {
  monacoRef: React.MutableRefObject<any>;
  editorRef: React.MutableRefObject<any>;
  content: string;
  editorReady: boolean;
  docType: string | null;
  shouldShowRunControls: boolean;
}) {
  const {
    monacoRef,
    editorRef,
    content,
    editorReady,
    docType,
    shouldShowRunControls
  } = params;

  const runGlyphDecorationsRef = useRef<string[]>([]);
  const exampleRunDecorationsRef = useRef<string[]>([]);
  const exampleRunInfoRef = useRef<ExampleInfo[]>([]);
  const runGlyphLineRef = useRef<number>(1);

  const computeRunLine = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }
    try {
      const doc = parseYamlDoc(content);
      const rootKeys = extractRootKeyInfo(doc, content);
      const typeKey = rootKeys.find(k => k.key === 'type');
      const runLine = (typeKey && typeKey.line) || 1;
      runGlyphLineRef.current = runLine;
    } catch { /* ignore */
    }
  }, [content, editorRef, monacoRef]);

  const handleRunClick = useCallback(() => {
    if (docType !== 'test' && docType !== 'api' && docType !== 'suite' && docType !== 'loadtest') {
      return;
    }
    try {
      if (docType === 'suite') {
        // Suite files use the dedicated runSuite handler for server/export support
        const suiteRunId = `suite-glyph:${Date.now()}`;
        window.vscode?.postMessage({command: 'runSuite', suiteRunId});
      } else {
        const message: any = {command: 'runCurrentDocument'};
        if (docType === 'api') {
          message.inputs = {exampleIndex: -1};
        }
        window.vscode?.postMessage(message);
      }
      window.vscode?.postMessage({command: 'showLogOutputChannel'});
    } catch (err: any) {
      showVSCodeMessage('error', err?.message || 'Failed to run document.');
    }
  }, [docType]);

  const handleRunExample = useCallback((exampleIndex: number) => {
    try {
      const apiData = yamlToAPI(content);
      const examplesList = safeList(apiData?.examples);
      const example = examplesList[exampleIndex];
      if (!example) {
        showVSCodeMessage(
            'warn', 'Selected example was not found in this document.');
        return;
      }
      window.vscode?.postMessage(
          {command: 'runCurrentDocument', inputs: {exampleIndex}});
      window.vscode?.postMessage({command: 'showLogOutputChannel'});
    } catch (err: any) {
      showVSCodeMessage('error', err?.message || 'Failed to run example.');
    }
  }, [content]);

  // compute run line when content/editorReady changes
  useEffect(
      () => {
        if (!monacoRef.current || !editorRef.current) {
          return;
        }
        if (!shouldShowRunControls || !editorReady) {
          const editor = editorRef.current;
          runGlyphDecorationsRef.current =
              editor.deltaDecorations(runGlyphDecorationsRef.current, []);
          return;
        }
        computeRunLine();
      },
      [
        shouldShowRunControls, editorReady, content, monacoRef, editorRef,
        computeRunLine
      ]);

  // place run glyph decoration
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || !editorReady) {
      return;
    }
    const editor = editorRef.current;
    if (!shouldShowRunControls || !editorReady) {
      runGlyphDecorationsRef.current =
          editor.deltaDecorations(runGlyphDecorationsRef.current, []);
      return;
    }
    const monaco = monacoRef.current;
    runGlyphDecorationsRef.current =
        editor.deltaDecorations(runGlyphDecorationsRef.current, [
          {
            range: new monaco.Range(
                runGlyphLineRef.current, 1, runGlyphLineRef.current, 1),
            options: {
              isWholeLine: true,
              glyphMarginClassName: 'mmt-run-glyph codicon codicon-run',
              glyphMarginHoverMessage: {value: 'Run this MMT file'},
              stickiness: monaco.editor.TrackedRangeStickiness
                              .NeverGrowsWhenTypingAtEdges,
            },
          },
        ]);

    return () => {
      runGlyphDecorationsRef.current =
          editor.deltaDecorations(runGlyphDecorationsRef.current, []);
    };
  }, [editorReady, shouldShowRunControls, content, monacoRef, editorRef]);

  // place example run decorations
  useEffect(
      () => {
        if (!monacoRef.current || !editorRef.current || !editorReady) {
          return;
        }
        const editor = editorRef.current;

        if (!shouldShowRunControls || !editorReady || docType !== 'api') {
          exampleRunInfoRef.current = [];
          exampleRunDecorationsRef.current =
              editor.deltaDecorations(exampleRunDecorationsRef.current, []);
          return;
        }

        const monaco = monacoRef.current;
        const doc = parseYamlDoc(content);
        const apiData = yamlToAPI(content);
        const examplesList = safeList(apiData?.examples);
        const positions =
            extractExampleLineInfo(doc, content).filter(info => info.line > 0);

        const filteredPositions = positions.filter(info => {
          const name = examplesList[info.index]?.name;
          return name && typeof name === 'string' && name.trim() !== '';
        });

        exampleRunInfoRef.current =
            filteredPositions.map(info => ({
                                    line: info.line,
                                    index: info.index,
                                    name: examplesList[info.index]?.name
                                  }));

        exampleRunDecorationsRef.current = editor.deltaDecorations(
            exampleRunDecorationsRef.current,
            filteredPositions
                    .map(info => {
                      const example = examplesList[info.index];
                      if (!example) {
                        return null;
                      }
                      const name = example?.name;
                      const label = name ? `Run example: ${name}` :
                                           `Run example ${info.index + 1}`;
                      return {
                        range: new monaco.Range(info.line, 1, info.line, 1),
                        options: {
                          isWholeLine: true,
                          glyphMarginClassName:
                              'mmt-run-glyph codicon codicon-run',
                          glyphMarginHoverMessage: {value: label},
                          stickiness: monaco.editor.TrackedRangeStickiness
                                          .NeverGrowsWhenTypingAtEdges,
                        },
                      };
                    })
                    .filter(v => v !== null) as any);

        return () => {
          exampleRunInfoRef.current = [];
          exampleRunDecorationsRef.current =
              editor.deltaDecorations(exampleRunDecorationsRef.current, []);
        };
      },
      [
        content, docType, editorReady, shouldShowRunControls, monacoRef,
        editorRef
      ]);

  // handle mouse clicks on glyphs
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || !editorReady) {
      return;
    }
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const mouseDownDisposable = editor.onMouseDown((e: any) => {
      if (e.target?.type !==
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
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
      if (docType === 'api') {
        const exampleInfo =
            exampleRunInfoRef.current.find(info => info.line === lineNumber);
        if (exampleInfo) {
          e.event?.preventDefault?.();
          void handleRunExample(exampleInfo.index);
        }
      }
    });

    return () => mouseDownDisposable.dispose();
  }, [handleRunClick, handleRunExample, docType, monacoRef, editorRef, editorReady]);

  return {handleRunClick, handleRunExample};
}

// Extract example positions from parsed YAML AST
function extractExampleLineInfo(
    doc: any, content: string): {line: number; index: number}[] {
  if (!doc || !doc.contents) {
    return [];
  }
  const root: any = doc.contents;
  const rootItems: any[] = Array.isArray(root?.items) ? root.items : [];
  const examplesPair = rootItems.find(item => item?.key?.value === 'examples');
  if (!examplesPair || !examplesPair.value) {
    return [];
  }
  const seqItems: any[] =
      Array.isArray(examplesPair.value?.items) ? examplesPair.value.items : [];
  const positions: {line: number; index: number}[] = [];
  seqItems.forEach((exampleNode, idx) => {
    let offset: number|undefined;
    if (Array.isArray(exampleNode?.range) &&
        typeof exampleNode.range[0] === 'number') {
      offset = exampleNode.range[0];
    } else if (
        exampleNode?.key && Array.isArray(exampleNode.key.range) &&
        typeof exampleNode.key.range[0] === 'number') {
      offset = exampleNode.key.range[0];
    }
    if (typeof offset === 'number') {
      positions.push({line: offsetToLineNumber(content, offset), index: idx});
    }
  });
  return positions;
}
