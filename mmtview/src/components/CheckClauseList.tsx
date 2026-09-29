import React from "react";
import type { ExpectUiRow } from "mmt-core/expectUi";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { peerStringToDisplay, peerStringToYaml } from "mmt-core/apiBodyEdit";
import OperatorSelect from "./OperatorSelect";
import TokenFieldInput from "./TokenFieldInput";

export type CheckClauseKind = "expect" | "require";

const CLAUSE_COPY: Record<CheckClauseKind, {
  add: string;
  remove: string;
  expected: string;
}> = {
  expect: {
    add: "+ Add expect",
    remove: "Remove expect",
    expected: "expected value",
  },
  require: {
    add: "+ Add require",
    remove: "Remove require",
    expected: "required value",
  },
};

export function CheckClauseFieldInput({
  list,
  value,
  onChange,
  title,
  placeholder,
}: {
  list?: string;
  value: string;
  onChange: (value: string) => void;
  title?: string;
  placeholder?: string;
}) {
  return (
    <input
      list={list}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="field-flex-2"
      title={title}
      placeholder={placeholder}
    />
  );
}

export function CheckClauseFieldSelect({
  value,
  options,
  onChange,
  title,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  title?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="field-flex-2"
      title={title}
    >
      <option value="" disabled>-- field --</option>
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
      {value && !options.includes(value) && (
        <option key={value} value={value}>{value}</option>
      )}
    </select>
  );
}

type CheckClauseListProps = {
  kind: CheckClauseKind;
  rows: ExpectUiRow[];
  onPartChange: (index: number, part: "field" | "op" | "expected", value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  renderField: (row: ExpectUiRow, index: number) => React.ReactNode;
  children?: React.ReactNode;
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
};

const CheckClauseList: React.FC<CheckClauseListProps> = ({
  kind,
  rows,
  onPartChange,
  onRemove,
  onAdd,
  renderField,
  children,
  canContainToken = false,
  valueContext,
}) => {
  const copy = CLAUSE_COPY[kind];
  const label = kind === "expect" ? "Expect" : "Require";

  return (
    <>
      <div className="label">{label}</div>
      <div className="field-pad">
        {children}
        {rows.length > 0 && (
          <div className="field-stack is-loose">
            {rows.map((row, i) => (
              <div key={i} className="field-inline">
                {renderField(row, i)}
                <OperatorSelect
                  value={row.op as any}
                  onChange={nextOp => onPartChange(i, "op", nextOp)}
                  className="no-shrink"
                  title="Comparison operator"
                />
                {canContainToken ? (
                  <div className="field-flex-2">
                    <TokenFieldInput
                      value={peerStringToDisplay(row.expected)}
                      canContainToken
                      valueContext={valueContext}
                      placeholder={copy.expected}
                      onCommit={val => onPartChange(i, "expected", peerStringToYaml(val))}
                      onDraftChange={val => onPartChange(i, "expected", peerStringToYaml(val))}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={row.expected}
                    onChange={e => onPartChange(i, "expected", e.target.value)}
                    className="field-flex-2"
                    placeholder={copy.expected}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="action-button codicon codicon-close no-shrink"
                  title={copy.remove}
                  aria-label={copy.remove}
                />
              </div>
            ))}
          </div>
        )}
        <div className="field-block">
          <button
            type="button"
            onClick={onAdd}
            className="ghost-add"
          >
            {copy.add}
          </button>
        </div>
      </div>
    </>
  );
};

export default CheckClauseList;
