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
  const [resolvedContent, setResolvedContent] = useState(content);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const processed = await processViewDataImports(
          content, filePath, projectRoot, keepDataImports);
      if (!cancelled) {
        setResolvedContent(processed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, filePath, projectRoot, keepDataImports]);

  return resolvedContent;
}
