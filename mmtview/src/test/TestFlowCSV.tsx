import React from "react";

interface Props {
  value: any;
  imports?: Record<string, string>;
  onChange: (value: any) => void;
}

const TestFlowCSV: React.FC<Props> = ({ value, imports, onChange }) => {
  const aliases = Object.entries(imports || {})
    .filter(([_, p]) => typeof p === 'string' && p.endsWith('.csv'))
    .map(([k]) => k);
  const cur = (value && typeof value === 'object' && typeof (value as any).data === 'string') ? (value as any).data : '';
  return (
    <select
      value={cur}
  onChange={(e) => onChange({ data: e.target.value })}
      style={{ width: 300 }}
    >
      <option value="">select a csv import</option>
      {aliases.map(a => <option key={a} value={a}>{a}</option>)}
    </select>
  );
};

export default TestFlowCSV;
