import {useEffect, useMemo, useRef, useState} from 'react';
import {parseYamlDoc} from 'mmt-core/markupConvertor';

export type MissingSuiteFileEntry = {path: string; line: number; column: number};

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function extractSuiteTestItems(docType: string | null, content: string) {
  if (docType !== 'suite' && docType !== 'loadtest') {
    return {paths: [] as string[], positions: new Map<string, {line: number; column: number}>()};
  }

  let parsed: any;
  try {
    parsed = parseYamlDoc(content);
  } catch {
    return {paths: [], positions: new Map()};
  }
  const root: any = parsed?.contents;
  const rootItems: any[] = Array.isArray(root?.items) ? root.items : [];
  if (docType === 'loadtest') {
    const testPair = rootItems.find((item) => item?.key?.value === 'test');
    const value = typeof testPair?.value?.value === 'string' ? testPair.value.value.trim() : '';
    const positions = new Map<string, {line: number; column: number}>();
    if (!value) {
      return {paths: [] as string[], positions};
    }
    const offset = Array.isArray(testPair?.value?.range) && typeof testPair.value.range[0] === 'number' ? testPair.value.range[0] : undefined;
    if (typeof offset === 'number') {
      const pre = content.slice(0, offset);
      const line = pre.split('\n').length;
      const lastNl = pre.lastIndexOf('\n');
      const column = lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
      positions.set(value, {line, column});
    }
    return {paths: [value], positions};
  }
  const testsPair = rootItems.find((item) => item?.key?.value === 'tests');
  const seqItems: any[] = Array.isArray(testsPair?.value?.items) ? testsPair.value.items : [];

  const positions = new Map<string, {line: number; column: number}>();
  const paths: string[] = [];

  for (const entry of seqItems) {
    const value = entry?.value;
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'then') {
      continue;
    }
    paths.push(trimmed);

    const offset = Array.isArray(entry?.range) && typeof entry.range[0] === 'number' ? entry.range[0] : undefined;
    if (typeof offset === 'number') {
      const pre = content.slice(0, offset);
      const line = pre.split('\n').length;
      const lastNl = pre.lastIndexOf('\n');
      const column = lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
      if (!positions.has(trimmed)) {
        positions.set(trimmed, {line, column});
      }
    }
  }

  return {paths: uniqStrings(paths), positions};
}

export function useSuiteTestsValidation(docType: string | null, content: string) {
  const {paths, positions} = useMemo(
      () => extractSuiteTestItems(docType, content),
      [docType, content]);
  const [missingSuiteFiles, setMissingSuiteFiles] = useState<MissingSuiteFileEntry[]>([]);
  const pendingIdRef = useRef<number>(0);

  useEffect(() => {
    if ((docType !== 'suite' && docType !== 'loadtest') || !window?.vscode) {
      setMissingSuiteFiles([]);
      return;
    }
    if (!paths.length) {
      setMissingSuiteFiles([]);
      return;
    }

    const requestId = Date.now();
    pendingIdRef.current = requestId;

    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command !== 'validateFilesExistResult') {
        return;
      }
      if (message.requestId && message.requestId !== pendingIdRef.current) {
        return;
      }

      const missing = Array.isArray(message.missing) ? message.missing : [];
      const formatted: MissingSuiteFileEntry[] = missing
        .filter((p: any) => typeof p === 'string')
        .map((p: string) => {
          const pos = positions.get(p);
          return {
            path: p,
            line: pos?.line ?? 1,
            column: pos?.column ?? 1,
          };
        });
      setMissingSuiteFiles(formatted);
    };

    window.addEventListener('message', listener);
    window.vscode.postMessage({
      command: 'validateFilesExist',
      requestId,
      files: paths,
    });

    return () => {
      window.removeEventListener('message', listener);
    };
  }, [docType, paths, positions]);

  return {missingSuiteFiles};
}
