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
  const [outputsByAlias, setOutputsByAlias] = useState<Record<string, string[]>>({});
  const pendingIdRef = useRef<number>(0);

  // Bump revision when the webview regains visibility so imported-file
  // changes are picked up without closing/reopening the editor.
  const [visRevision, setVisRevision] = useState(0);
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        setVisRevision(r => r + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  useEffect(() => {
    if (!entries.length || !window?.vscode) {
      setMissingImports([]);
      setInputsByAlias({});
      setOutputsByAlias({});
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
      const rawOutputs = message.apiOutputsByAlias;
      if (rawOutputs && typeof rawOutputs === 'object') {
        setOutputsByAlias(rawOutputs as Record<string, string[]>);
      } else {
        setOutputsByAlias({});
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, visRevision]);

  return {missingImports, inputsByAlias, outputsByAlias};
}
