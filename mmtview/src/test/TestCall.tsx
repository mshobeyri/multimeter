import React from "react";

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
  // Derive selected alias from YAML: either a plain string or an object with `call`
  const aliasFromValue =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && typeof (value as any).call === 'string'
        ? (value as any).call
        : '';

  const aliases = imports ? Object.keys(imports) : [];
  const currentAlias = aliases.includes(aliasFromValue) ? aliasFromValue : '';
  const currentId = value && typeof value === 'object' && typeof (value as any).id === 'string'
    ? (value as any).id
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const alias = e.target.value;
    if (!alias) {
  onChange({});
    } else {
      // preserve current id when switching alias
      onChange(currentId ? { call: alias, id: currentId } : { call: alias });
    }
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idVal = e.target.value;
    if (!currentAlias) {
      // no alias selected; ignore id edits to avoid invalid shape
      return;
    }
    if (idVal && idVal.trim().length > 0) {
      onChange({ call: currentAlias, id: idVal });
    } else {
      // empty id removes the id field
      onChange({ call: currentAlias });
    }
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
      <div>
        <label className="Label" style={{ display: 'block', marginBottom: 4 }}>Id</label>
        <input
          type="text"
          value={currentId}
          onChange={handleIdChange}
          disabled={!currentAlias}
          style={{ width: 240, padding: '6px 8px' }}
          placeholder="Optional id to capture call result"
        />
      </div>
    </div>
  );
};

export default TestCall;