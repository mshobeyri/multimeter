import React from "react";
import { parseYamlDoc } from "mmt-core/markupConvertor";
import { findTestCallAliasProblems, findTestCallInputsProblems, type MissingImportEntry, type ProblemEntry } from "../text/validator";
import { opsList, ReportLevel, ReportConfig } from "mmt-core/TestData";
import FieldWithRemove from "../components/FieldWithRemove";
import OperatorSelect from "../components/OperatorSelect";

/** A single row in the expect UI list */
interface ExpectRow {
  field: string;
  op: string;
  expected: string;
}

interface TestCallProps {
  value: any; // current value can be alias string
  imports?: Record<string, string>; // alias -> file path
  onChange: (value: any) => void;
  placeholder?: string;
  missingImports?: MissingImportEntry[];
  importedInputsByAlias?: Record<string, string[]>;
  importedOutputsByAlias?: Record<string, string[]>;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
  missingImports,
  importedInputsByAlias,
  importedOutputsByAlias,
}) => {
  // Local model to avoid excessive parent re-renders while editing
  const [local, setLocal] = React.useState<any>(typeof value === 'object' && value ? value : null);
  const emitTimerRef = React.useRef<number | null>(null);
  const localRef = React.useRef<any>(local);
  React.useEffect(() => { localRef.current = local; }, [local]);
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
    if (stableStringify(ai) !== stableStringify(bi)) return false;
    if (stableStringify(ac.expect) !== stableStringify(bc.expect)) return false;
    if (stableStringify(ac.report) !== stableStringify(bc.report)) return false;
    return true;
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
  React.useEffect(() => {
    if (value && typeof value === 'object' && value !== localRef.current) {
      setLocal(value);
    }
  }, [value]);

  // --- Inline expect helpers ---

  /** Parse an ExpectMap (from YAML) into a flat list of ExpectRow for the UI */
  const expectMapToRows = (map: Record<string, any> | undefined): ExpectRow[] => {
    if (!map || typeof map !== 'object') { return []; }
    const rows: ExpectRow[] = [];
    for (const [field, val] of Object.entries(map)) {
      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        const s = String(v ?? '').trim();
        let matched = false;
        for (const op of opsList) {
          if (s.startsWith(op + ' ') || s === op) {
            rows.push({ field, op, expected: s.slice(op.length).trim() });
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Plain value → default equality
          rows.push({ field, op: '==', expected: s });
        }
      }
    }
    return rows;
  };

  /** Convert flat ExpectRow[] back to an ExpectMap for YAML serialisation */
  const rowsToExpectMap = (rows: ExpectRow[]): Record<string, any> | undefined => {
    if (rows.length === 0) { return undefined; }
    const map: Record<string, any> = {};
    for (const r of rows) {
      const entry = r.op === '==' ? r.expected : `${r.op} ${r.expected}`;
      if (map[r.field] !== undefined) {
        // Multiple entries for same field → array
        if (Array.isArray(map[r.field])) {
          map[r.field].push(entry);
        } else {
          map[r.field] = [map[r.field], entry];
        }
      } else {
        map[r.field] = entry;
      }
    }
    return map;
  };

  /** Read expect rows from local state */
  const expectList: ExpectRow[] = React.useMemo(() => {
    const raw = local && typeof local === 'object' ? (local as any).expect : undefined;
    return expectMapToRows(raw);
  }, [local]);

  const callReport = React.useMemo(() => {
    return local && typeof local === 'object' ? (local as any).report : undefined;
  }, [local]);

  const reportLevelOptions: ReportLevel[] = ['all', 'fails', 'none'];

  // Parse current report value into internal/external
  const isReportObjectForm = callReport && typeof callReport === 'object';
  const reportInternalValue: ReportLevel = isReportObjectForm
    ? (callReport as ReportConfig).internal ?? 'all'
    : (typeof callReport === 'string' ? callReport as ReportLevel : 'all');
  const reportExternalValue: ReportLevel = isReportObjectForm
    ? (callReport as ReportConfig).external ?? 'fails'
    : (typeof callReport === 'string' ? callReport as ReportLevel : 'fails');

  const handleReportChange = (internal: ReportLevel, external: ReportLevel) => {
    let rep: any;
    if (internal === 'all' && external === 'fails') {
      rep = undefined;
    } else if (internal === external) {
      rep = internal;
    } else {
      rep = { internal, external };
    }
    const next = buildCallObj({ report: rep });
    setLocal(next);
    scheduleEmit(next);
  };

  /** Build the full call object from current state */
  const buildCallObj = (overrides?: {
    alias?: string; id?: string; inputs?: Record<string, any>;
    expect?: ExpectRow[]; report?: any;
  }) => {
    const alias = overrides?.alias ?? currentAlias;
    const id = overrides?.id ?? currentId;
    const inp = overrides?.inputs ?? inputs;
    const exp = overrides?.expect ?? expectList;
    const rep = overrides?.report !== undefined ? overrides.report : callReport;
    if (!alias) { return {}; }
    const obj: any = { call: alias };
    if (id && id.trim().length > 0) { obj.id = id; }
    obj.inputs = inp;
    const expectMap = rowsToExpectMap(exp);
    if (expectMap) { obj.expect = expectMap; }
    if (rep !== undefined) { obj.report = rep; }
    return obj;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const alias = e.target.value;
    if (!alias) {
      setLocal(null);
      scheduleEmit({});
      return;
    }
    const next = buildCallObj({ alias });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idVal = e.target.value;
    if (!currentAlias) return;
    const next = buildCallObj({ id: idVal });
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

  const availableOutputs = React.useMemo(() => {
    if (!currentAlias || !importedOutputsByAlias) {
      return ['_.status'] as string[];
    }
    const outs = (importedOutputsByAlias[currentAlias] || []).filter(Boolean);
    return ['_.status', ...outs];
  }, [currentAlias, importedOutputsByAlias]);

  // --- Expect handlers ---

  const handleAddExpect = () => {
    const defaultField = availableOutputs[0] || '';
    const next = buildCallObj({ expect: [...expectList, { field: defaultField, op: '==', expected: '' }] });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRemoveExpect = (index: number) => {
    const next = buildCallObj({ expect: expectList.filter((_, i) => i !== index) });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleExpectPartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = expectList.map((row, i) => i === index ? { ...row, [part]: val } : row);
    const next = buildCallObj({ expect: updated });
    setLocal(next);
    scheduleEmit(next);
  };

  const onInputChange = (key: string, val: string) => {
    if (!currentAlias) return;
    const nextInputs = { ...inputs, [key]: parseLiteral(val) };
    const next = buildCallObj({ inputs: nextInputs });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRemoveInput = (key: string) => {
    if (!currentAlias) return;
    const nextInputs = { ...inputs };
    delete nextInputs[key];
    const next = buildCallObj({ inputs: nextInputs });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleAddInput = (key: string) => {
    if (!currentAlias) return;
    if (keys.includes(key)) {
      return;
    }
    const nextInputs = { ...inputs, [key]: '' };
    const next = buildCallObj({ inputs: nextInputs });
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {keys.map(k => {
                  const hasProblem = invalidInputKeys.has(k);
                  const problemMessage = hasProblem ? validationProblems.inputProblems.find(p => p.inputKey === k)?.message : undefined;
                  const valueForInput = typeof inputs[k] === 'string' ? inputs[k] as string : JSON.stringify(inputs[k]);
                  return (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: '12px', opacity: 0.85 }}>{k}
                        {hasProblem && problemMessage && (
                          <span
                            className="action-button codicon codicon-warning"
                            style={{ fontSize: "10px", color: "yellow"}}
                            title={problemMessage}
                            aria-label={problemMessage}
                          />
                        )}
                      </div>
                      <FieldWithRemove
                        value={valueForInput}
                        onChange={(e) => onInputChange(k, e)}
                        onRemovePressed={() => handleRemoveInput(k)}
                      />
                    </div>
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

          <div className="label">Expect</div>
          <div style={{ padding: "5px" }}>
            {expectList.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expectList.map((row, i) => {
                  return (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select
                        value={row.field}
                        onChange={(e) => handleExpectPartChange(i, 'field', e.target.value)}
                        style={{ flex: 2, minWidth: 0 }}
                        title="Output field to check"
                      >
                        <option value="" disabled>-- field --</option>
                        {availableOutputs.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                        {row.field && !availableOutputs.includes(row.field) && (
                          <option key={row.field} value={row.field}>{row.field}</option>
                        )}
                      </select>
                      <OperatorSelect
                        value={row.op as any}
                        onChange={(nextOp) => handleExpectPartChange(i, 'op', nextOp)}
                        style={{ flex: 1, minWidth: 0 }}
                        title="Comparison operator"
                      />
                      <input
                        type="text"
                        value={row.expected}
                        onChange={(e) => handleExpectPartChange(i, 'expected', e.target.value)}
                        style={{ flex: 2, minWidth: 0 }}
                        placeholder="expected value"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExpect(i)}
                        className="action-button codicon codicon-close"
                        style={{ flexShrink: 0 }}
                        title="Remove expect"
                        aria-label="Remove expect"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No expectations</div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={handleAddExpect}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px dashed var(--vscode-editorWidget-border, #555)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                + Add expect
              </button>
            </div>
          </div>

          {expectList.length > 0 && (
            <>
              <div className="label">Report</div>
              <div style={{ padding: '5px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <label
                    title="Report level when running this test directly"
                    style={{ userSelect: 'none', fontSize: 12 }}
                  >
                    Internal:
                  </label>
                  <select
                    value={reportInternalValue}
                    onChange={e => handleReportChange(e.target.value as ReportLevel, reportExternalValue)}
                    style={{ fontSize: 12 }}
                  >
                    {reportLevelOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <label
                    title="Report level when this test is imported or added to a suite"
                    style={{ userSelect: 'none', fontSize: 12 }}
                  >
                    External:
                  </label>
                  <select
                    value={reportExternalValue}
                    onChange={e => handleReportChange(reportInternalValue, e.target.value as ReportLevel)}
                    style={{ fontSize: 12 }}
                  >
                    {reportLevelOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TestCall;