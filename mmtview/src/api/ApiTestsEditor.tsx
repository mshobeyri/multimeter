import React from "react";
import type { ApiTestBlock } from "mmt-core/APIData";
import type { ApiTestExpectItem } from "mmt-core/apiTestEval";
import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectMapToUiRows,
  type ExpectUiRow,
  uiRowsToExpectMap,
} from "mmt-core/expectUi";
import CheckClauseList, { CheckClauseFieldInput } from "../components/CheckClauseList";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

const DEFAULT_FIELDS = [
  "status",
  "status_code",
  "body",
  "body.message",
  "headers",
  "cookies",
  "duration",
];

export interface ApiTestsEditorProps {
  test?: ApiTestBlock;
  onChange: (test: ApiTestBlock | undefined) => void;
  /** Result rows from the last Send / run (optional). */
  results?: ApiTestExpectItem[] | null;
  /** Suggested field names (e.g. declared outputs) — shown first in the field select. */
  fieldSuggestions?: string[];
  /** Expected values: resolved/token dual-mode when they contain tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
}

function buildExpectBlock(expectRows: ExpectUiRow[]): ApiTestBlock | undefined {
  const expectMap = uiRowsToExpectMap(expectRows);
  if (!expectMap) {
    return undefined;
  }
  return { expect: expectMap as ApiTestBlock["expect"] };
}

const ApiTestsEditor: React.FC<ApiTestsEditorProps> = ({
  test,
  onChange,
  results,
  fieldSuggestions,
  canContainToken = false,
  valueContext,
}) => {
  const expectList = React.useMemo(() => expectMapToUiRows(test?.expect as any), [test?.expect]);

  const suggestions = React.useMemo(() => {
    // Declared outputs first, then built-in response fields (deduped).
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

  const emit = (nextExpect: ExpectUiRow[]) => {
    onChange(buildExpectBlock(nextExpect));
  };

  const resultByComparison = React.useMemo(() => {
    const map = new Map<string, ApiTestExpectItem>();
    for (const item of results || []) {
      if (item.level !== "expect") {
        continue;
      }
      map.set(item.comparison, item);
    }
    return map;
  }, [results]);

  const resultForRow = (row: ExpectUiRow): ApiTestExpectItem | undefined => {
    if (!results || results.length === 0) {
      return undefined;
    }
    const op = row.explicitOperator || row.op !== "==" ? row.op : "==";
    const comparison = `${row.field} ${op} ${row.expected}`;
    return resultByComparison.get(comparison) ||
        results.find(r => r.level === "expect" && r.comparison.startsWith(`${row.field} `));
  };

  const resultIcon = (row: ExpectUiRow) => {
    const result = resultForRow(row);
    const ok = result?.status === "passed";
    const failed = result?.status === "failed";
    return (
      <span
        className={`apitest-result-slot no-shrink${ok ? " is-pass" : ""}${failed ? " is-fail" : ""}`}
        title={ok ? "Passed" : failed ? "Failed" : undefined}
        aria-label={ok ? "Passed" : failed ? "Failed" : undefined}
        aria-hidden={!result}
      >
        {ok ? <span className="codicon codicon-check" /> : null}
        {failed ? <span className="codicon codicon-close" /> : null}
      </span>
    );
  };

  return (
    <div className="apitest-tests">
      <CheckClauseList
        kind="expect"
        rows={expectList}
        canContainToken={canContainToken}
        valueContext={valueContext}
        onPartChange={(index, part, val) => {
          const updated = expectList.map((row, i) => (
            i === index ? applyExpectUiRowChange(row, part, val) : row
          ));
          emit(updated);
        }}
        onRemove={(index) => emit(expectList.filter((_, i) => i !== index))}
        onAdd={() => {
          const defaultField = expectList.length > 0
            ? expectList[expectList.length - 1].field
            : (suggestions[0] || "status");
          emit([...expectList, createEmptyExpectUiRow(defaultField)]);
        }}
        renderField={(row, i) => (
          <>
            {resultIcon(row)}
            <CheckClauseFieldInput
              list="apitest-expect-fields"
              value={row.field}
              onChange={val => {
                const updated = expectList.map((r, idx) => (
                  idx === i ? applyExpectUiRowChange(r, "field", val) : r
                ));
                emit(updated);
              }}
              title="Output field"
              placeholder="status"
            />
          </>
        )}
      >
        <datalist id="apitest-expect-fields">
          {suggestions.map(field => (
            <option key={field} value={field} />
          ))}
        </datalist>
      </CheckClauseList>
    </div>
  );
};

export default ApiTestsEditor;
