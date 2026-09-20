import React, { useEffect, useState } from "react";
import { CheckOps, getFuzzyPercentOperatorBase, getFuzzyPercentOperatorValue, getOpOptionLabel, getTimeOperatorBase, getTimeOperatorVelocity, isFuzzyPercentAnyOperator, isTimeAnyOperator, makeFuzzyPercentOperator, makeTimeOperator, normalizeTimeVelocity, selectableOpsList } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

type OperatorSelectProps = {
  value: CheckOps;
  onChange: (value: CheckOps) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

const OperatorSelect: React.FC<OperatorSelectProps> = ({ value, onChange, className, style, title }) => {
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
    <div className={["op-select", className].filter(Boolean).join(" ")} style={style}>
      <div className="op-select-face">
        <select
          value={selectValue}
          onChange={e => updateOperator(e.target.value as CheckOps)}
          title={title}
        >
          {safeList(selectableOpsList).map((relation) => (
            <option
              key={relation}
              value={relation}
              title={getOpOptionLabel(relation)}
            >
              {getOpOptionLabel(relation)}
            </option>
          ))}
        </select>
        <span className="op-select-value">
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
          className="op-select-percent"
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
          className="op-select-velocity"
        />
      )}
    </div>
  );
};

export default OperatorSelect;
