import React from "react";
import { CheckOps } from "mmt-core/TestData";
import OperatorSelect from "../components/OperatorSelect";
import type { LogicalJoin } from "mmt-core/JSerTestFlow";

export interface IfClause {
  actual: string;
  op: CheckOps;
  expected: string;
}

interface TestIfProps {
  first: IfClause;
  join?: LogicalJoin;
  second?: IfClause;
  onChange: (val: { first: IfClause; join?: LogicalJoin; second?: IfClause }) => void;
}

const joinSelectStyle: React.CSSProperties = {
  width: 64,
  flex: "0 0 auto",
  fontFamily: "var(--vscode-font-family)",
  fontSize: "var(--vscode-font-size, 13px)",
  background: "var(--vscode-input-background)",
  color: "var(--vscode-input-foreground)",
  border: "1px solid var(--vscode-input-border, transparent)",
  borderRadius: 2,
  padding: "2px 4px",
};

const clauseRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  width: "100%",
};

const TestIf: React.FC<TestIfProps> = ({
  first,
  join,
  second,
  onChange,
}) => {
  const hasSecond = !!second;

  const renderClause = (
    clause: IfClause,
    onClauseChange: (next: IfClause) => void,
  ) => (
    <div style={clauseRowStyle}>
      <input
        value={clause.actual}
        style={{ width: "100%" }}
        onChange={v => onClauseChange({ ...clause, actual: v.target.value })}
        placeholder="actual"
      />
      <OperatorSelect
        value={clause.op}
        onChange={nextOp => onClauseChange({ ...clause, op: nextOp })}
        style={{ width: 190, flex: "0 0 auto" }}
        title="Comparison operator"
      />
      <input
        value={clause.expected}
        style={{ width: "100%" }}
        onChange={e => onClauseChange({ ...clause, expected: e.target.value })}
        placeholder="expected"
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      {renderClause(first, next => onChange({ first: next, join, second }))}
      {hasSecond ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
          <select
            value={join || "&&"}
            onChange={e => onChange({
              first,
              join: e.target.value as LogicalJoin,
              second,
            })}
            style={joinSelectStyle}
            title="Combine with previous condition"
          >
            <option value="&&">&&</option>
            <option value="||">||</option>
          </select>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderClause(second!, next => onChange({ first, join: join || "&&", second: next }))}
          </div>
          <button
            type="button"
            className="action-button"
            title="Remove second condition"
            onClick={() => onChange({ first })}
            style={{ flex: "0 0 auto", padding: "2px 6px" }}
          >
            <span className="codicon codicon-remove" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="action-button"
          title="Add && / || condition"
          onClick={() => onChange({
            first,
            join: "&&",
            second: { actual: "", op: "==", expected: "" },
          })}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            fontSize: 11,
            opacity: 0.85,
          }}
        >
          <span className="codicon codicon-add" aria-hidden />
          && / ||
        </button>
      )}
    </div>
  );
};

export default TestIf;
