import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ApiTestBlock } from "mmt-core/data/APIData";
import type { ApiTestExpectItem } from "mmt-core/runner/apiTestEval";
import { resolveApiOutputField } from "mmt-core/runner/apiTestEval";
import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectMapToUiRows,
  expectStoredToDisplay,
  uiRowsToExpectMap,
} from "mmt-core/api-edit/expectUi";
import CheckClauseList, {
  newCheckClauseRowId,
  stripCheckClauseRowIds,
  withCheckClauseRowIds,
  type CheckClauseRow,
} from "../components/CheckClauseList";
import type { RuntimeTokenValueContext } from "mmt-core/api-edit/apiBodyEdit";
import { shortValueTypeLabel, yamlValueToInputBox } from "mmt-core/parse/yamlValueConvert";
import type { JSONValue } from "mmt-core/data/CommonData";
import { fieldTrailingLayout } from "../components/FieldWithRemove";

const DEFAULT_FIELDS = [
  "status",
  "status_code",
  "duration",
  "body",
  "headers",
  "cookies",
];

export interface ApiTestsEditorProps {
  test?: ApiTestBlock;
  onChange: (test: ApiTestBlock | undefined) => void;
  /** Result rows from the last Send / run (optional). */
  results?: ApiTestExpectItem[] | null;
  /** Last run outputs — used in view mode as key(actual). */
  runOutputs?: Record<string, any> | null;
  /** Suggested field names (e.g. declared outputs) — shown first in the field select. */
  fieldSuggestions?: string[];
  /** Expected values: resolved/token dual-mode when they contain tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
  /** Edit mode shows clause editors; view mode shows non-selectable values. */
  editing?: boolean;
  /** When true, omit the built-in Expect label (parent SectionEditLabel owns it). */
  hideLabel?: boolean;
}

function formatActualValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return yamlValueToInputBox(value as JSONValue);
  } catch {
    return String(value);
  }
}

function buildExpectBlock(expectRows: CheckClauseRow[]): ApiTestBlock | undefined {
  const expectMap = uiRowsToExpectMap(stripCheckClauseRowIds(expectRows));
  if (!expectMap) {
    return undefined;
  }
  return { expect: expectMap as ApiTestBlock["expect"] };
}

function expectSourceSig(expect: ApiTestBlock["expect"] | undefined): string {
  return JSON.stringify(expect ?? null);
}

function rowOperator(row: CheckClauseRow): string {
  return row.explicitOperator || row.op !== "==" ? row.op : "==";
}

const ApiTestsEditor: React.FC<ApiTestsEditorProps> = ({
  test,
  onChange,
  results,
  runOutputs,
  fieldSuggestions,
  canContainToken = false,
  valueContext,
  editing = true,
  hideLabel = false,
}) => {
  const sourceSig = useMemo(
    () => expectSourceSig(test?.expect),
    [test?.expect],
  );
  const lastEmittedSig = useRef(sourceSig);
  const [rows, setRows] = useState<CheckClauseRow[]>(() =>
    withCheckClauseRowIds(expectMapToUiRows(test?.expect as any)),
  );

  // Reload rows when example / external expect changes — not when we just emitted.
  useEffect(() => {
    if (sourceSig === lastEmittedSig.current) {
      return;
    }
    setRows(withCheckClauseRowIds(expectMapToUiRows(test?.expect as any)));
    lastEmittedSig.current = sourceSig;
  }, [sourceSig, test?.expect]);

  const fieldOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const name of [...(fieldSuggestions || []), ...DEFAULT_FIELDS]) {
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      out.push(name);
    }
    return out;
  }, [fieldSuggestions]);

  const emit = (next: CheckClauseRow[]) => {
    setRows(next);
    const block = buildExpectBlock(next);
    lastEmittedSig.current = expectSourceSig(block?.expect);
    onChange(block);
  };

  const resultByComparison = useMemo(() => {
    const map = new Map<string, ApiTestExpectItem>();
    for (const item of results || []) {
      if (item.level !== "expect") {
        continue;
      }
      map.set(item.comparison, item);
    }
    return map;
  }, [results]);

  const resultForRow = (row: CheckClauseRow): ApiTestExpectItem | undefined => {
    if (!results || results.length === 0) {
      return undefined;
    }
    const op = rowOperator(row);
    const expectedDisplay = canContainToken
      ? expectStoredToDisplay(row.expected)
      : row.expected;
    // Match each check on its own comparison — never fall back to "any result
    // for this field", or multi-expect fields steal each other's pass/fail.
    const comparison = `${row.field} ${op} ${row.expected}`;
    const comparisonDisplay = `${row.field} ${op} ${expectedDisplay}`;
    return resultByComparison.get(comparison) ||
        resultByComparison.get(comparisonDisplay) ||
        results.find(r => (
          r.level === "expect" &&
          (r.comparison === comparison || r.comparison === comparisonDisplay)
        ));
  };

  const resultIcon = (row: CheckClauseRow) => {
    const result = resultForRow(row);
    const ok = result?.status === "passed";
    const failed = result?.status === "failed";
    return (
      <span
        className={`apitest-result-slot${ok ? " is-pass" : ""}${failed ? " is-fail" : ""}`}
        title={ok ? "Passed" : failed ? "Failed" : undefined}
        aria-label={ok ? "Passed" : failed ? "Failed" : undefined}
        aria-hidden={!result}
      >
        {ok ? <span className="codicon codicon-check" /> : null}
        {failed ? <span className="codicon codicon-close" /> : null}
      </span>
    );
  };

  if (!editing) {
    if (rows.length === 0) {
      return <div className="apitest-empty">No expect checks.</div>;
    }
    return (
      <div className="apitest-tests apitest-tests--view">
        <div className="check-clause-table is-readonly">
          {rows.map((row) => {
            const op = rowOperator(row);
            const expectedDisplay = canContainToken
              ? expectStoredToDisplay(row.expected)
              : row.expected;
            const typeLabel = row.expected.trim() !== ""
              ? shortValueTypeLabel(row.valueKind || "string")
              : undefined;
            const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
              typeLabel,
              buttonCount: 0,
            });
            const result = resultForRow(row);
            const actualRaw = result && Object.prototype.hasOwnProperty.call(result, "actual")
              ? result.actual
              : (runOutputs ? resolveApiOutputField(runOutputs, row.field) : undefined);
            const actualText = formatActualValue(actualRaw);
            const fieldLabel = actualText !== undefined
              ? `${row.field}(${actualText})`
              : row.field;
            return (
              <div key={row.rowId} className="check-clause-row is-readonly">
                <div className="check-clause-status">{resultIcon(row)}</div>
                <div className="check-clause-view-box" title={fieldLabel}>
                  <span className="check-clause-view-box-text">{fieldLabel}</span>
                </div>
                <div className="check-clause-view-box is-op" title={op}>
                  <span className="check-clause-view-box-text">{op}</span>
                </div>
                <div className="check-clause-view-box" style={{ paddingRight }}>
                  <span className="check-clause-view-box-text">{expectedDisplay}</span>
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
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="apitest-tests">
      <CheckClauseList
        kind="expect"
        rows={rows}
        fieldOptions={fieldOptions}
        canContainToken={canContainToken}
        valueContext={valueContext}
        hideLabel={hideLabel}
        renderStatus={resultIcon}
        onPartChange={(index, part, val) => {
          emit(rows.map((row, i) => (
            i === index
              ? { ...applyExpectUiRowChange(row, part, val), rowId: row.rowId }
              : row
          )));
        }}
        onRemove={(index) => emit(rows.filter((_, i) => i !== index))}
        onAdd={() => {
          const defaultField = rows.length > 0
            ? rows[rows.length - 1].field
            : (fieldOptions[0] || "status");
          emit([
            ...rows,
            { ...createEmptyExpectUiRow(defaultField), rowId: newCheckClauseRowId() },
          ]);
        }}
      />
    </div>
  );
};

export default ApiTestsEditor;
