import React, { useEffect, useState } from "react";
import { CheckOps, getFuzzyPercentOperatorBase, getFuzzyPercentOperatorValue, getOpOptionLabel, getTimeOperatorBase, getTimeOperatorVelocity, isFuzzyPercentAnyOperator, isTimeAnyOperator, makeFuzzyPercentOperator, makeTimeOperator, normalizeTimeVelocity, selectableOpsList } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

type OperatorSelectProps = {
  value: CheckOps;
  onChange: (value: CheckOps) => void;
  style?: React.CSSProperties;
  title?: string;
};

const OperatorSelect: React.FC<OperatorSelectProps> = ({ value, onChange, style, title }) => {
  const fuzzyBase = getFuzzyPercentOperatorBase(value);
  const timeBase = getTimeOperatorBase(value);
  const selectValue = (fuzzyBase || timeBase || value) as CheckOps;
  const fuzzyPercent = getFuzzyPercentOperatorValue(value);
  const timeVelocity = getTimeOperatorVelocity(value);
  const [velocityText, setVelocityText] = useState(timeVelocity);

  useEffect(() => {
    setVelocityText(timeVelocity);
  }, [timeVelocity]);

  const updateOperator = (nextValue: CheckOps) => {
    if (nextValue === '>%' || nextValue === '<%') {
      onChange(makeFuzzyPercentOperator(nextValue, fuzzyPercent));
      return;
    }
    if (nextValue === '=s~' || nextValue === '!s~') {
      onChange(makeTimeOperator(nextValue, timeVelocity));
      return;
    }
    onChange(nextValue);
  };

  const updatePercent = (nextPercent: number) => {
    const base = fuzzyBase || '>%';
    onChange(makeFuzzyPercentOperator(base, nextPercent));
  };

  const updateVelocity = (nextVelocity: string) => {
    setVelocityText(nextVelocity);
    const normalized = normalizeTimeVelocity(nextVelocity);
    if (!normalized) {
      return;
    }
    onChange(makeTimeOperator(timeBase || '=s~', normalized));
  };

  const commitVelocity = () => {
    const normalized = normalizeTimeVelocity(velocityText);
    const next = normalized || timeVelocity;
    setVelocityText(next);
    onChange(makeTimeOperator(timeBase || '=s~', next));
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
      {isTimeAnyOperator(value) && (
        <input
          type="text"
          value={velocityText}
          onChange={e => updateVelocity(e.target.value)}
          onBlur={commitVelocity}
          title="Acceptable time difference (velocity)"
          placeholder="1s"
          style={{ width: 88, flex: '0 0 auto' }}
        />
      )}
    </div>
  );
};

export default OperatorSelect;
