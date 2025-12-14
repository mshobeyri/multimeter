import React from "react";
import { parseYamlDoc } from "mmt-core/markupConvertor";
import { findTestCallAliasProblems, findTestCallInputsProblems, type MissingImportEntry, type ProblemEntry } from "../text/validator";

interface TestCallProps {
  value: any; // current value can be alias string
  imports?: Record<string, string>; // alias -> file path
  onChange: (value: any) => void;
  placeholder?: string;
  missingImports?: MissingImportEntry[];
  importedInputsByAlias?: Record<string, string[]>;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
  missingImports,
  importedInputsByAlias,
}) => {
  // Local model to avoid excessive parent re-renders while editing
  const [local, setLocal] = React.useState<any>(typeof value === 'object' && value ? value : null);
  const emitTimerRef = React.useRef<number | null>(null);
  const scheduleEmit = (next: any) => {
    if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
    // Avoid redundant parent updates if nothing actually changed
    const eq = equalCall(next, value);
    emitTimerRef.current = window.setTimeout(() => { if (!eq) onChange(next); }, 160);
  };

  const stableStringify = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
    const keys = Object.keys(obj).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = obj[k];
    return JSON.stringify(out);
  };
  const equalCall = (a: any, b: any): boolean => {
    const ac = a && typeof a === 'object' ? a : {};
    const bc = b && typeof b === 'object' ? b : {};
    if ((ac.call || '') !== (bc.call || '')) return false;
    if ((ac.id || '') !== (bc.id || '')) return false;
    const ai = ac.inputs && typeof ac.inputs === 'object' ? ac.inputs : {};
    const bi = bc.inputs && typeof bc.inputs === 'object' ? bc.inputs : {};
    return stableStringify(ai) === stableStringify(bi);
  };

  const parseLiteral = (text: string): any => {
    const t = (text ?? '').trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
    if (/^(true|false)$/i.test(t)) return /^true$/i.test(t);
    if (/^-?\d+(?:\.\d+)?$/.test(t)) { const n = Number(t); if (!Number.isNaN(n)) return n; }
    return text;
  };

  // Derive selected alias from YAML: either a plain string or an object with `call`
  const aliasFromValue =
    typeof value === 'string' ? value
      : value && typeof value === 'object' && typeof (value as any).call === 'string' ? (value as any).call
        : '';
  const mmtImports: Record<string, string> | undefined = imports ? Object.fromEntries(Object.entries(imports).filter(([_, p]) => typeof p === 'string' && p.endsWith('.mmt'))) as Record<string, string> : undefined;
  const aliases = mmtImports ? Object.keys(mmtImports) : [];
  const currentAlias = aliases.includes(aliasFromValue)
    ? aliasFromValue
    : (
      local && typeof local === 'object' && typeof (local as any).call === 'string'
        && aliases.includes((local as any).call)
        ? (local as any).call
        : ''
    );
  const currentId = local && typeof local === 'object' && typeof (local as any).id === 'string'
    ? (local as any).id
    : (value && typeof value === 'object' && typeof (value as any).id === 'string' ? (value as any).id : '');

  // Keep local in sync if parent changes externally (avoid stomping during our own edits by shallow check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (value && typeof value === 'object' && value !== local) {
      setLocal(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const alias = e.target.value;
    if (!alias) {
      setLocal(null);
      scheduleEmit({});
      return;
    }
    const next = currentId ? { call: alias, id: currentId, inputs: (local as any)?.inputs || {} } : { call: alias, inputs: (local as any)?.inputs || {} };
    setLocal(next);
    scheduleEmit(next);
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idVal = e.target.value;
    if (!currentAlias) return;
    const base = { call: currentAlias, inputs: (local as any)?.inputs || {} } as any;
    const next = idVal && idVal.trim().length > 0 ? { ...base, id: idVal } : base;
    setLocal(next);
  };

  const inputs: Record<string, any> = React.useMemo(() => {
    const source = local && typeof local === 'object' ? (local as any).inputs : undefined;
    return (source && typeof source === 'object') ? source as Record<string, any> : {};
  }, [local]);
  const keys = React.useMemo(() => Object.keys(inputs), [inputs]);

  const aliasForValidation = typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : (typeof (value as any)?.call === 'string' && (value as any).call.trim().length > 0
      ? (value as any).call.trim()
      : (currentAlias || ''));

  const formatInputValue = (val: any): string => {
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    if (typeof val === 'string') {
      return JSON.stringify(val);
    }
    if (val === null || val === undefined) {
      return 'null';
    }
    return JSON.stringify(val);
  };

  const validationProblems = React.useMemo(() => {
    if (!aliasForValidation) {
      return { aliasProblems: [] as ProblemEntry[], inputProblems: [] as ProblemEntry[] };
    }
    const importsMap = mmtImports || {};
    const lines: string[] = ['type: test'];
    const importEntries = Object.entries(importsMap);
    if (importEntries.length) {
      lines.push('import:');
      importEntries.forEach(([alias, path]) => {
        lines.push(`  ${alias}: ${path}`);
      });
    } else {
      lines.push('import: {}');
    }
    lines.push('steps:');
    lines.push(`  - call: ${aliasForValidation}`);
    if (keys.length) {
      lines.push('    inputs:');
      keys.forEach(key => {
        lines.push(`      ${key}: ${formatInputValue(inputs[key])}`);
      });
    }
    const content = lines.join('\n');
    try {
      const doc = parseYamlDoc(content);
      return {
        aliasProblems: findTestCallAliasProblems(content, doc, 'test', importsMap),
        inputProblems: findTestCallInputsProblems(content, doc, 'test', importedInputsByAlias || null),
      };
    } catch {
      return { aliasProblems: [], inputProblems: [] };
    }
  }, [aliasForValidation, importedInputsByAlias, inputs, keys, mmtImports]);

  const missingImportWarnings: ProblemEntry[] = React.useMemo(() => {
    if (!aliasForValidation || !Array.isArray(missingImports)) {
      return [];
    }
    return missingImports
      .filter(entry => entry.alias === aliasForValidation)
      .map(entry => ({
        message: `Imported file "${entry.path}" for alias "${entry.alias}" was not found.`,
        severity: 'warning' as const,
        alias: entry.alias,
      }));
  }, [aliasForValidation, missingImports]);

  const aliasProblems = React.useMemo(() => (
    [...missingImportWarnings, ...validationProblems.aliasProblems]
  ), [missingImportWarnings, validationProblems.aliasProblems]);

  const invalidInputKeys = React.useMemo(() => {
    const keys = new Set<string>();
    validationProblems.inputProblems.forEach(problem => {
      if (problem.inputKey) {
        keys.add(problem.inputKey);
      }
    });
    return keys;
  }, [validationProblems.inputProblems]);

  const availableInputs = React.useMemo(() => {
    if (!currentAlias || !importedInputsByAlias) {
      return [] as string[];
    }
    return (importedInputsByAlias[currentAlias] || []).filter(Boolean);
  }, [currentAlias, importedInputsByAlias]);

  const missingInputKeys = React.useMemo(() => (
    availableInputs.filter((key) => !keys.includes(key))
  ), [availableInputs, keys]);

  const onInputChange = (key: string, val: string) => {
    if (!currentAlias) return;
    const nextInputs = { ...inputs, [key]: parseLiteral(val) };
    const next = currentId ? { call: currentAlias, id: currentId, inputs: nextInputs } : { call: currentAlias, inputs: nextInputs };
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRemoveInput = (key: string) => {
    if (!currentAlias) return;
    const nextInputs = { ...inputs };
    delete nextInputs[key];
    const next = currentId ? { call: currentAlias, id: currentId, inputs: nextInputs } : { call: currentAlias, inputs: nextInputs };
    setLocal(next);
    scheduleEmit(next);
  };

  const handleAddInput = (key: string) => {
    if (!currentAlias) return;
    if (keys.includes(key)) {
      return;
    }
    const nextInputs = { ...inputs, [key]: '' };
    const next = currentId ? { call: currentAlias, id: currentId, inputs: nextInputs } : { call: currentAlias, inputs: nextInputs };
    setLocal(next);
    scheduleEmit(next);
  };

  const aliasHasProblem = aliasProblems.length > 0;
  const aliasErrorTitle = aliasHasProblem ? aliasProblems.map(p => p.message).join('\n') : undefined;

  return (
    <div style={{ width: '100%', borderCollapse: "collapse", tableLayout: "fixed" }}>
      <select
        value={currentAlias}
        onChange={handleChange}
        style={{
          width: '100%',
          borderColor: aliasHasProblem ? 'var(--vscode-errorForeground, #f14c4c)' : undefined,
          boxShadow: aliasHasProblem ? '0 0 0 1px var(--vscode-errorForeground, #f14c4c)' : undefined,
        }}
        title={aliasErrorTitle}
      >
        <option value="">{placeholder}</option>
        {aliases.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <div className="label">Id</div>
      <div style={{ padding: "5px" }}>
        <input
          type="text"
          value={currentId}
          onChange={handleIdChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              scheduleEmit(local);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter') {
              scheduleEmit(local);
            }
          }}
          disabled={!currentAlias}
          style={{ width: '100%' }}
          placeholder="Optional id to capture call result"
        />
      </div>

      {currentAlias && (
        <>
          <div className="label">Parameters</div>
          <div style={{ padding: "5px" }}>
            {keys.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', columnGap: 12, rowGap: 8 }}>
                {keys.map(k => {
                  const hasProblem = invalidInputKeys.has(k);
                  const problemMessage = hasProblem ? validationProblems.inputProblems.find(p => p.inputKey === k)?.message : undefined;
                  const valueForInput = typeof inputs[k] === 'string' ? inputs[k] as string : JSON.stringify(inputs[k]);
                  return (
                    <React.Fragment key={k}>
                      <div style={{ alignSelf: 'center', opacity: 0.9 }}>{k}</div>
                      <input
                        type="text"
                        value={valueForInput}
                        onChange={(e) => onInputChange(k, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            scheduleEmit(local);
                          }
                        }}
                        onKeyUp={(e) => {
                          if (e.key === 'Enter') {
                            scheduleEmit(local);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderColor: hasProblem ? 'var(--vscode-errorForeground, #f14c4c)' : undefined,
                          boxShadow: hasProblem ? '0 0 0 1px var(--vscode-errorForeground, #f14c4c)' : undefined,
                        }}
                        title={problemMessage}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInput(k)}
                        style={{
                          alignSelf: 'center',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--vscode-errorForeground, #f14c4c)',
                          cursor: 'pointer',
                        }}
                        aria-label={`Remove ${k}`}
                        title={`Remove ${k}`}
                      >
                        ×
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No parameters</div>
            )}
            {missingInputKeys.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {missingInputKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAddInput(key)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px dashed var(--vscode-editorWidget-border, #555)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    + {key}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TestCall;