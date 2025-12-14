import {useEffect, useMemo, useRef, useState} from 'react';
import {type MissingImportEntry} from './validator';

function sanitizeImports(importsMap?: Record<string, string> | null): Record<string, string> {
  if (!importsMap || typeof importsMap !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [alias, value] of Object.entries(importsMap)) {
    if (typeof alias !== 'string' || !alias.trim()) {
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      continue;
    }
    out[alias] = value;
  }
  return out;
}

export function useImportValidation(importsMap?: Record<string, string> | null) {
  const normalized = useMemo(() => sanitizeImports(importsMap), [importsMap]);
  const entries = useMemo(
      () => Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b)),
      [normalized]);
  const [missingImports, setMissingImports] = useState<MissingImportEntry[]>([]);
  const [inputsByAlias, setInputsByAlias] = useState<Record<string, string[]>>({});
  const pendingIdRef = useRef<number>(0);

  useEffect(() => {
    if (!entries.length || !window?.vscode) {
      setMissingImports([]);
      setInputsByAlias({});
      return;
    }
    const requestId = Date.now();
    pendingIdRef.current = requestId;

    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command !== 'importValidationResult') {
        return;
      }
      if (message.requestId && message.requestId !== pendingIdRef.current) {
        return;
      }
      const rawMissing = Array.isArray(message.missing) ? message.missing : [];
      const formatted: MissingImportEntry[] = rawMissing
        .filter((item: any) => item && typeof item.alias === 'string' && typeof item.path === 'string')
        .map((item: any) => ({alias: item.alias, path: item.path}));
      setMissingImports(formatted);
      const rawInputs = message.apiInputsByAlias;
      if (rawInputs && typeof rawInputs === 'object') {
        setInputsByAlias(rawInputs as Record<string, string[]>);
      } else {
        setInputsByAlias({});
      }
    };

    window.addEventListener('message', listener);
    window.vscode.postMessage({
      command: 'validateImports',
      imports: Object.fromEntries(entries),
      requestId,
      includeInputs: true,
    });

    return () => {
      window.removeEventListener('message', listener);
    };
  }, [entries]);

  return {missingImports, inputsByAlias};
}
