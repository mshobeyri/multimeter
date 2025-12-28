import { useCallback } from 'react';
import { apiToYaml, yamlToAPI } from 'mmt-core/apiParsePack';
import { yamlToTest, testToYaml } from 'mmt-core/testParsePack';
import { yamlToDoc, docToYaml } from 'mmt-core/docParsePack';
import { APIData } from 'mmt-core/APIData';
import { TestData } from 'mmt-core/TestData';
import { DocData } from 'mmt-core/DocData';
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

export function buildCanonicalYaml(content: string, docType: string | null): string | null {
  try {
    switch (docType) {
      case 'api': {
        const apiData = yamlToAPI(content);
        if (!apiData || typeof apiData !== 'object' || apiData === ({} as APIData)) {
          showVSCodeMessage('error', 'Document is not a valid YAML.');
          return null;
        }
        return apiToYaml(apiData);
      }
      case 'test': {
        const testData = yamlToTest(content);
        if (!testData || typeof testData !== 'object' || testData === ({} as TestData)) {
          showVSCodeMessage('error', 'Document is not a valid YAML.');
          return null;
        }
        return testToYaml(testData);
      }
      case 'doc': {
        const docData = yamlToDoc(content);
        if (!docData || typeof docData !== 'object' || docData === ({} as DocData)) {
          showVSCodeMessage('error', 'Document is not a valid YAML.');
          return null;
        }
        return docToYaml(docData);
      }
      case 'suite': {
        showVSCodeMessage('warn', 'Suite reordering is not supported yet.');
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
