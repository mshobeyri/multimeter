import {useEffect, useMemo, useRef, useState} from 'react';
import {parseYamlDoc} from 'mmt-core/markupConvertor';

export type MissingSuiteFileEntry = {path: string; line: number; column: number};

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collectStringSequenceItems(
  rootItems: any[],
  content: string,
  key: string,
  options?: {skipThen?: boolean}
) {
  const pair = rootItems.find((item) => item?.key?.value === key);
  const seqItems: any[] = Array.isArray(pair?.value?.items) ? pair.value.items : [];
  const positions = new Map<string, {line: number; column: number}>();
  const paths: string[] = [];

  for (const entry of seqItems) {
    const value = entry?.value;
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || (options?.skipThen && trimmed === 'then')) {
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

  return {paths, positions};
}

function mergePositions(target: Map<string, {line: number; column: number}>, source: Map<string, {line: number; column: number}>) {
  source.forEach((position, path) => {
    if (!target.has(path)) {
      target.set(path, position);
    }
  });
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
  const positions = new Map<string, {line: number; column: number}>();
  const paths: string[] = [];
  const serverItems = collectStringSequenceItems(rootItems, content, 'servers');
  const testItems = collectStringSequenceItems(rootItems, content, 'tests', {skipThen: true});
  paths.push(...serverItems.paths, ...testItems.paths);
  mergePositions(positions, serverItems.positions);
  mergePositions(positions, testItems.positions);

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
    const vscodeApi = window.vscode;

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

    const requestValidation = () => {
      const requestId = pendingIdRef.current + 1;
      pendingIdRef.current = requestId;
      vscodeApi.postMessage({
        command: 'validateFilesExist',
        requestId,
        files: paths,
      });
    };

    window.addEventListener('message', listener);
    requestValidation();
    const intervalId = window.setInterval(requestValidation, 300);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('message', listener);
    };
  }, [docType, paths, positions]);

  return {missingSuiteFiles};
}
