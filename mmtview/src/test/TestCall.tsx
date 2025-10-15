import React from "react";
import parseYaml from "mmt-core/markupConvertor";
import { readFile, showVSCodeMessage } from "../vsAPI";

interface TestCallProps {
  value: any; // current value can be alias string
  imports?: Record<string, string>; // alias -> file path
  onChange: (value: any) => void;
  placeholder?: string;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
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
  const aliases = imports ? Object.keys(imports) : [];
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

  // Load defaults when alias changes
  React.useEffect(() => {
    if (!imports || !currentAlias) return;
    const fileName = imports[currentAlias];
    if (!fileName) return;
    readFile(fileName)
      .then((content: string) => {
        const yaml = parseYaml(content);
        if (!yaml || typeof yaml !== 'object') { showVSCodeMessage('error', `Cannot parse ${fileName}!`); return; }
        if (!yaml.type || (yaml.type !== 'test' && yaml.type !== 'api')) { showVSCodeMessage('error', `${fileName} type should be test or api!`); return; }
        const defaults = yaml.inputs && typeof yaml.inputs === 'object' ? yaml.inputs : {};
        const prevInputs = local && typeof local === 'object' && (local as any).inputs && typeof (local as any).inputs === 'object' ? (local as any).inputs : (value && typeof value === 'object' && (value as any).inputs || {});
        const merged = { ...defaults, ...prevInputs };
        const next = currentId ? { call: currentAlias, id: currentId, inputs: merged } : { call: currentAlias, inputs: merged };
        setLocal(next);
        // Only emit if different from current value to avoid loops
        if (!equalCall(next, value)) scheduleEmit(next);
      })
      .catch(() => {
        showVSCodeMessage('error', `Failed to read file: \n${fileName}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAlias, imports]);

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

  const inputs: Record<string, any> = (local && typeof local === 'object' && (local as any).inputs) || {};
  const keys = Object.keys(inputs);

  const onInputChange = (key: string, val: string) => {
    if (!currentAlias) return;
    const nextInputs = { ...inputs, [key]: parseLiteral(val) };
    const next = currentId ? { call: currentAlias, id: currentId, inputs: nextInputs } : { call: currentAlias, inputs: nextInputs };
    setLocal(next);
  };

  return (
    <div>
      <select
        value={currentAlias}
        onChange={handleChange}
        style={{ width: 180, marginBottom: 8 }}
      >
        <option value="">{placeholder}</option>
        {aliases.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <div style={{ marginBottom: 8 }}>
        <label className="Label" style={{ display: 'block', marginBottom: 4 }}>Id</label>
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
          style={{ width: 240, padding: '6px 8px', marginLeft: 16 }}
          placeholder="Optional id to capture call result"
        />
      </div>
      {currentAlias && (
        <div>
          <label className="Label">Parameters</label>
          <div style={{ paddingLeft: 12, marginTop: 8 }}>
            {keys.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', columnGap: 12, rowGap: 8 }}>
                {keys.map(k => (
                  <React.Fragment key={k}>
                    <div style={{ alignSelf: 'center', opacity: 0.9 }}>{k}</div>
                    <input
                      type="text"
                      value={typeof inputs[k] === 'string' ? inputs[k] as string : JSON.stringify(inputs[k])}
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
                      style={{ width: '100%', padding: '6px 8px' }}
                    />
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No parameters</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCall;