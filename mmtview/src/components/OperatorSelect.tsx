import React from "react";
import { CheckOps, getOpOptionLabel, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

type OperatorSelectProps = {
  value: CheckOps;
  onChange: (value: CheckOps) => void;
  style?: React.CSSProperties;
  title?: string;
};

const OperatorSelect: React.FC<OperatorSelectProps> = ({ value, onChange, style, title }) => {
  return (
    <div style={{ position: "relative", ...style }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as CheckOps)}
        style={{
          width: "100%",
          color: "transparent",
          backgroundColor: "transparent",
        }}
        title={title}
      >
        {safeList(opsList).map((relation, idx) => (
          <option
            key={relation}
            value={relation}
            title={safeList(opsNames)[idx]}
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
        {value}
      </span>
    </div>
  );
};

export default OperatorSelect;
