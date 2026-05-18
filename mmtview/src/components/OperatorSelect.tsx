import React from "react";
import { CheckOps, getFuzzyPercentOperatorBase, getFuzzyPercentOperatorValue, getOpOptionLabel, isFuzzyPercentAnyOperator, makeFuzzyPercentOperator, selectableOpsList } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

type OperatorSelectProps = {
  value: CheckOps;
  onChange: (value: CheckOps) => void;
  style?: React.CSSProperties;
  title?: string;
};

const OperatorSelect: React.FC<OperatorSelectProps> = ({ value, onChange, style, title }) => {
  const fuzzyBase = getFuzzyPercentOperatorBase(value);
  const selectValue = (fuzzyBase || value) as CheckOps;
  const fuzzyPercent = getFuzzyPercentOperatorValue(value);

  const updateOperator = (nextValue: CheckOps) => {
    if (nextValue === '=%' || nextValue === '!%') {
      onChange(makeFuzzyPercentOperator(nextValue, fuzzyPercent));
      return;
    }
    onChange(nextValue);
  };

  const updatePercent = (nextPercent: number) => {
    const base = fuzzyBase || '=%';
    onChange(makeFuzzyPercentOperator(base, nextPercent));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, ...style }}>
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <select
          value={selectValue}
          onChange={e => updateOperator(e.target.value as CheckOps)}
          style={{
            width: "100%",
            color: "transparent",
            backgroundColor: "transparent",
          }}
          title={title}
        >
          {safeList(selectableOpsList).map((relation) => (
            <option
              key={relation}
              value={relation}
              title={getOpOptionLabel(relation)}
              style={{ color: "var(--vscode-foreground)" }}
            >
              {getOpOptionLabel(relation)}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            left: 8,
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "var(--vscode-foreground)",
          }}
        >
          {selectValue}
        </span>
      </div>
      {isFuzzyPercentAnyOperator(value) && (
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={fuzzyPercent}
          onChange={e => updatePercent(Number(e.target.value))}
          title="Fuzzy match percentage"
          style={{ width: 68, flex: '0 0 auto' }}
        />
      )}
    </div>
  );
};

export default OperatorSelect;
