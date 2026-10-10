import {useContext, useEffect, useState} from 'react';
import {FileContext} from './fileContext';
import {processViewDataImports} from './processViewDataImports';

export function useResolvedYamlContent(
    content: string,
    options?: {keepDataImports?: boolean; filePath?: string; projectRoot?: string},
): string {
  const fileCtx = useContext(FileContext);
  const filePath = options?.filePath ?? fileCtx.mmtFilePath;
  const projectRoot = options?.projectRoot ?? fileCtx.projectRoot;
  const keepDataImports = options?.keepDataImports ?? false;
  const [source, setSource] = useState(content);
  const [resolvedContent, setResolvedContent] = useState(content);

  // Adopt the source text in this render. Waiting for the import effect left
  // every field on the previous value for a frame, which shoves the caret to
  // the end of the text the user is editing.
  if (source !== content) {
    setSource(content);
    setResolvedContent(content);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const processed = await processViewDataImports(
          content, filePath, projectRoot, keepDataImports);
      if (!cancelled && processed !== content) {
        setResolvedContent(processed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, filePath, projectRoot, keepDataImports]);

  return resolvedContent;
}
