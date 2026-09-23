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
  expanded?: boolean;
}

const TestIf: React.FC<TestIfProps> = ({
  first,
  join,
  second,
  onChange,
  expanded,
}) => {
  const hasSecond = !!second;

  const renderClause = (
    clause: IfClause,
    onClauseChange: (next: IfClause) => void,
  ) => (
    <div className="field-inline is-flush">
      <input
        value={clause.actual}
        className="mmt-fill"
        onChange={v => onClauseChange({ ...clause, actual: v.target.value })}
        placeholder="actual"
      />
      <OperatorSelect
        value={clause.op}
        onChange={nextOp => onClauseChange({ ...clause, op: nextOp })}
        className="is-fixed"
        title="Comparison operator"
      />
      <input
        value={clause.expected}
        className="mmt-fill"
        onChange={e => onClauseChange({ ...clause, expected: e.target.value })}
        placeholder="expected"
      />
    </div>
  );

  return (
    <div className="field-stack mmt-fill">
      {renderClause(first, next => onChange({ first: next, join, second }))}
      {expanded && (hasSecond ? (
        <div className="field-inline mmt-fill">
          <select
            value={join || "&&"}
            onChange={e => onChange({
              first,
              join: e.target.value as LogicalJoin,
              second,
            })}
            className="if-join"
            title="Combine with previous condition"
          >
            <option value="&&">&&</option>
            <option value="||">||</option>
          </select>
          <div className="field-grow">
            {renderClause(second!, next => onChange({ first, join: join || "&&", second: next }))}
          </div>
          <button
            type="button"
            className="action-button if-remove"
            title="Remove second condition"
            onClick={() => onChange({ first })}
          >
            <span className="codicon codicon-remove" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="action-button if-add"
          title="Add && / || condition"
          onClick={() => onChange({
            first,
            join: "&&",
            second: { actual: "", op: "==", expected: "" },
          })}
        >
          <span className="codicon codicon-add" aria-hidden />
          && / ||
        </button>
      ))}
    </div>
  );
};

export default TestIf;
