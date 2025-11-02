import React from "react";

type VarKind = 'set' | 'var' | 'const' | 'let';

export interface TestFlowVarProps {
  type: VarKind;
  stepData: any;
  onChange: (value: any) => void;
}

const parseLiteral = (text: string): any => {
  const t = (text ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\'') && t.endsWith('\''))) {
    return t.slice(1, -1);
  }
  if (/^(true|false)$/i.test(t)) {
    return /^true$/i.test(t);
  }
  if (/^-?\d+(?:\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return text;
};

const TestFlowVar: React.FC<TestFlowVarProps> = ({ type, stepData, onChange }) => {
  const currentType = type;
  const payload = (stepData && typeof stepData === 'object') ? stepData[currentType] : undefined;
  const key = payload && typeof payload === 'object' ? Object.keys(payload)[0] || '' : '';
  const valRaw = key ? (payload as any)[key] : '';
  const val = typeof valRaw === 'string' ? valRaw : (valRaw != null ? JSON.stringify(valRaw) : '');

  const handleKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newKind = e.target.value as VarKind;
    const nextObj = key ? { [newKind]: { [key]: parseLiteral(val) } } : { [newKind]: {} } as any;
    onChange(nextObj);
  };
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    const nextPayload = newKey ? { [newKey]: parseLiteral(val) } : {};
    onChange({ [currentType]: nextPayload });
  };
  const handleValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const nextPayload = key ? { [key]: parseLiteral(newVal) } : {};
    onChange({ [currentType]: nextPayload });
  };

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
      <select value={currentType} onChange={handleKindChange} style={{ width: '30%' }}>
        <option value="set">set</option>
        <option value="var">var</option>
        <option value="const">const</option>
        <option value="let">let</option>
      </select>
      <input
        placeholder="property (e.g., outputs.name)"
        value={key}
        onChange={handleKeyChange}
        style={{ width: '35%' }}
      />
      <input
        placeholder="value (e.g., user_info.name or 'text')"
        value={val}
        onChange={handleValChange}
        style={{ width: '35%' }}
      />
    </div>
  );
};

export default TestFlowVar;
