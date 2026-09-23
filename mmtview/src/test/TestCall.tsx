import React from "react";
import { parseYamlDoc } from "mmt-core/markupConvertor";
import { findTestCallAliasProblems, findTestCallInputsProblems, type MissingImportEntry, type ProblemEntry } from "../text/validator";
import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectMapToUiRows,
  type ExpectUiRow,
  uiRowsToExpectMap,
} from "mmt-core/expectUi";
import FieldWithRemove from "../components/FieldWithRemove";
import CheckClauseList, { CheckClauseFieldSelect } from "../components/CheckClauseList";
import ReportLevelFields from "../components/ReportLevelFields";

/** A single row in the expect UI list */
type ExpectRow = ExpectUiRow;

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
    if ((ac.title || '') !== (bc.title || '')) return false;
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
  const callableImports: Record<string, string> | undefined = imports ? Object.fromEntries(Object.entries(imports).filter(([_, p]) => {
    if (typeof p !== 'string') {
      return false;
    }
    const lower = p.toLowerCase();
    return lower.endsWith('.mmt') || lower.endsWith('.http') || lower.endsWith('.https') || lower.endsWith('.bru') || lower.endsWith('.bruno');
  })) as Record<string, string> : undefined;
  const aliases = callableImports ? Object.keys(callableImports) : [];
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
  const currentTitle = local && typeof local === 'object' && typeof (local as any).title === 'string'
    ? (local as any).title
    : (value && typeof value === 'object' && typeof (value as any).title === 'string' ? (value as any).title : '');

  // Keep local in sync if parent changes externally (avoid stomping during our own edits by shallow check)
  React.useEffect(() => {
    if (value && typeof value === 'object' && value !== localRef.current) {
      setLocal(value);
    }
  }, [value]);

  // --- Inline expect helpers ---

  /** Read expect rows from local state */
  const expectList: ExpectRow[] = React.useMemo(() => {
    const raw = local && typeof local === 'object' ? (local as any).expect : undefined;
    return expectMapToUiRows(raw);
  }, [local]);

  const requireList: ExpectRow[] = React.useMemo(() => {
    const raw = local && typeof local === 'object' ? (local as any).require : undefined;
    return expectMapToUiRows(raw);
  }, [local]);

  const callReport = React.useMemo(() => {
    return local && typeof local === 'object' ? (local as any).report : undefined;
  }, [local]);

  /** Build the full call object from current state */
  const buildCallObj = (overrides?: {
    alias?: string; id?: string; title?: string; inputs?: Record<string, any>;
    expect?: ExpectRow[]; require?: ExpectRow[]; report?: any;
  }) => {
    const alias = overrides?.alias ?? currentAlias;
    const id = overrides?.id ?? currentId;
    const title = overrides?.title ?? currentTitle;
    const inp = overrides?.inputs ?? inputs;
    const exp = overrides?.expect ?? expectList;
    const req = overrides?.require ?? requireList;
    const rep = overrides?.report !== undefined ? overrides.report : callReport;
    if (!alias) { return {}; }
    const obj: any = { call: alias };
    if (id && id.trim().length > 0) { obj.id = id; }
    if (title && title.trim().length > 0) { obj.title = title; }
    obj.inputs = inp;
    const expectMap = uiRowsToExpectMap(exp);
    if (expectMap) { obj.expect = expectMap; }
    const requireMap = uiRowsToExpectMap(req);
    if (requireMap) { obj.require = requireMap; }
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
    const importsMap = callableImports || {};
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
  }, [aliasForValidation, importedInputsByAlias, inputs, keys, callableImports]);

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

  // --- Expect / require handlers ---

  const handleAddExpect = () => {
    const defaultField = expectList.length > 0
      ? expectList[expectList.length - 1].field
      : (availableOutputs[0] || '');
    const next = buildCallObj({
      expect: [...expectList, createEmptyExpectUiRow(defaultField)],
    });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const titleVal = e.target.value;
    if (!currentAlias) return;
    const next = buildCallObj({ title: titleVal });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRemoveExpect = (index: number) => {
    const next = buildCallObj({ expect: expectList.filter((_, i) => i !== index) });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleExpectPartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = expectList.map((row, i) => (
      i === index ? applyExpectUiRowChange(row, part, val) : row
    ));
    const next = buildCallObj({ expect: updated });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleAddRequire = () => {
    const defaultField = requireList.length > 0
      ? requireList[requireList.length - 1].field
      : (availableOutputs[0] || '');
    const next = buildCallObj({
      require: [...requireList, createEmptyExpectUiRow(defaultField)],
    });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRemoveRequire = (index: number) => {
    const next = buildCallObj({ require: requireList.filter((_, i) => i !== index) });
    setLocal(next);
    scheduleEmit(next);
  };

  const handleRequirePartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = requireList.map((row, i) => (
      i === index ? applyExpectUiRowChange(row, part, val) : row
    ));
    const next = buildCallObj({ require: updated });
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
    <div className="mmt-fill">
      <select
        value={currentAlias}
        onChange={handleChange}
        className={`mmt-fill${aliasHasProblem ? " is-invalid" : ""}`}
        title={aliasErrorTitle}
      >
        <option value="">{placeholder}</option>
        {aliases.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <div className="label">Id</div>
      <div className="field-pad">
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
          placeholder="Optional id to capture call result"
        />
      </div>

      <div className="label">Title</div>
      <div className="field-pad">
        <input
          type="text"
          value={currentTitle}
          onChange={handleTitleChange}
          disabled={!currentAlias}
          placeholder="Optional display title"
        />
      </div>

      {currentAlias && (
        <>
          <div className="label">Parameters</div>
          <div className="field-pad">
            {keys.length ? (
              <div className="field-stack is-loose">
                {keys.map(k => {
                  const hasProblem = invalidInputKeys.has(k);
                  const problemMessage = hasProblem ? validationProblems.inputProblems.find(p => p.inputKey === k)?.message : undefined;
                  const valueForInput = typeof inputs[k] === 'string' ? inputs[k] as string : JSON.stringify(inputs[k]);
                  return (
                    <div key={k} className="field-stack is-compact">
                      <div className="param-key">{k}
                        {hasProblem && problemMessage && (
                          <span
                            className="action-button codicon codicon-warning param-warn"
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
              <div className="muted">No parameters</div>
            )}
            {missingInputKeys.length > 0 && (
              <div className="field-inline is-wrap">
                {missingInputKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAddInput(key)}
                    className="ghost-add"
                  >
                    + {key}
                  </button>
                ))}
              </div>
            )}
          </div>

          <CheckClauseList
            kind="expect"
            rows={expectList}
            onPartChange={handleExpectPartChange}
            onRemove={handleRemoveExpect}
            onAdd={handleAddExpect}
            renderField={(row, i) => (
              <CheckClauseFieldSelect
                value={row.field}
                options={availableOutputs}
                onChange={val => handleExpectPartChange(i, "field", val)}
                title="Output field to check"
              />
            )}
          />

          <CheckClauseList
            kind="require"
            rows={requireList}
            onPartChange={handleRequirePartChange}
            onRemove={handleRemoveRequire}
            onAdd={handleAddRequire}
            renderField={(row, i) => (
              <CheckClauseFieldSelect
                value={row.field}
                options={availableOutputs}
                onChange={val => handleRequirePartChange(i, "field", val)}
                title="Output field to require"
              />
            )}
          />

          {(expectList.length > 0 || requireList.length > 0) && (
            <ReportLevelFields
              value={callReport}
              onChange={(report) => {
                const next = buildCallObj({ report });
                setLocal(next);
                scheduleEmit(next);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TestCall;