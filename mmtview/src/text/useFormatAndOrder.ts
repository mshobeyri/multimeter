import { useCallback } from 'react';
import { formatMmtYaml } from 'mmt-core/mmtFormat';
import { showVSCodeMessage } from '../vsAPI';

export function useFormatAndOrder({
  contentRef,
  docType,
  setContent,
}: {
  contentRef: React.RefObject<string>;
  docType: string | null;
  setContent: (value: string) => void;
}) {
  const reorderDocument = useCallback(() => {
    if (!docType) {
      showVSCodeMessage('warn', 'Unknown document type. Cannot reorder items.');
      return;
    }
    const currentContent = contentRef.current ?? '';
    const reordered = buildCanonicalYaml(currentContent, docType);
    if (!reordered) {
      showVSCodeMessage('warn', 'Unable to reorder items for this document.');
      return;
    }
    if (reordered === currentContent) {
      showVSCodeMessage('info', 'Document is already formatted.');
      return;
    }
    setContent(reordered);
  }, [contentRef, docType, setContent]);

  return { reorderDocument };
}

/** Format Document path — AST-based so `#` comments are preserved. */
export function buildCanonicalYaml(content: string, _docType: string | null): string | null {
  try {
    return formatMmtYaml(content).formatted;
  } catch {
    showVSCodeMessage('error', 'Document is not a valid YAML.');
    return null;
  }
}
