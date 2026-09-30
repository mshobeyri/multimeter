import React from "react";
import type { ExpectUiRow } from "mmt-core/expectUi";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { peerStringToDisplay, peerStringToYaml } from "mmt-core/apiBodyEdit";
import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
} from "./convertor";
import OperatorSelect from "./OperatorSelect";
import TokenFieldInput from "./TokenFieldInput";
import { fieldTrailingLayout } from "./FieldWithRemove";
import { shortValueTypeLabel } from "mmt-core/yamlValueConvert";

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

/** Stable row identity for list rendering (avoids jump on field rename). */
export type CheckClauseRow = ExpectUiRow & { rowId: string };

let nextRowId = 1;
export function newCheckClauseRowId(): string {
  nextRowId += 1;
  return `cc-${nextRowId}`;
}

export function withCheckClauseRowIds(rows: ExpectUiRow[]): CheckClauseRow[] {
  return rows.map(row => ({ ...row, rowId: newCheckClauseRowId() }));
}

export function stripCheckClauseRowIds(rows: CheckClauseRow[]): ExpectUiRow[] {
  return rows.map(({ rowId: _rowId, ...row }) => row);
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
  const opts = [...options];
  if (value && !opts.includes(value)) {
    opts.unshift(value);
  }
  if (opts.length === 0) {
    opts.push("status");
  }
  const effective = opts.includes(value) ? value : opts[0];
  return (
    <select
      value={effective}
      onChange={e => onChange(e.target.value)}
      className="check-clause-key"
      title={title}
    >
      {opts.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

type CheckClauseListProps = {
  kind: CheckClauseKind;
  rows: CheckClauseRow[];
  fieldOptions: string[];
  onPartChange: (index: number, part: "field" | "op" | "expected", value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  renderStatus?: (row: CheckClauseRow, index: number) => React.ReactNode;
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
};

const CheckClauseList: React.FC<CheckClauseListProps> = ({
  kind,
  rows,
  fieldOptions,
  onPartChange,
  onRemove,
  onAdd,
  renderStatus,
  canContainToken = false,
  valueContext,
}) => {
  const copy = CLAUSE_COPY[kind];
  const label = kind === "expect" ? "Expect" : "Require";

  return (
    <>
      <div className="label">{label}</div>
      <div className="field-pad">
        {rows.length > 0 && (
          <div className="check-clause-table">
            {rows.map((row, i) => {
              const typeLabel = row.expected.trim() !== ""
                ? shortValueTypeLabel(row.valueKind || "string")
                : undefined;
              const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
                typeLabel,
                buttonCount: 0,
              });
              return (
                <div key={row.rowId} className="check-clause-row">
                  <div className="check-clause-status">
                    {renderStatus ? renderStatus(row, i) : (
                      <span className="apitest-result-slot" aria-hidden />
                    )}
                  </div>
                  <CheckClauseFieldSelect
                    value={row.field}
                    options={fieldOptions}
                    onChange={val => onPartChange(i, "field", val)}
                    title="Output field"
                  />
                  <div className="check-clause-op">
                    <OperatorSelect
                      value={row.op as any}
                      onChange={nextOp => onPartChange(i, "op", nextOp)}
                      compact
                      title="Comparison operator"
                    />
                  </div>
                  <div className="check-clause-value field-with-remove">
                    {canContainToken ? (
                      <TokenFieldInput
                        value={
                          (row.expected.startsWith('"') && row.expected.endsWith('"')) ||
                          (row.expected.startsWith("'") && row.expected.endsWith("'"))
                            ? row.expected
                            : peerStringToDisplay(row.expected)
                        }
                        canContainToken
                        valueContext={valueContext}
                        placeholder={copy.expected}
                        style={{ paddingRight }}
                        onCommit={val => onPartChange(
                          i,
                          "expected",
                          yamlValueToInputBox(inputBoxToYamlValue(peerStringToYaml(val))),
                        )}
                        onDraftChange={val => onPartChange(
                          i,
                          "expected",
                          yamlValueToInputBox(inputBoxToYamlValue(peerStringToYaml(val))),
                        )}
                      />
                    ) : (
                      <input
                        type="text"
                        value={row.expected}
                        onChange={e => onPartChange(i, "expected", e.target.value)}
                        placeholder={copy.expected}
                        style={{ paddingRight }}
                      />
                    )}
                    {typeText ? (
                      <span
                        className="field-type-affix"
                        style={{ right: typeRight }}
                        title="Value type"
                      >
                        {typeText}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="check-clause-remove codicon codicon-close"
                    title={copy.remove}
                    aria-label={copy.remove}
                  />
                </div>
              );
            })}
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
