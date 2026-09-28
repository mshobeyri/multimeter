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
}

function buildTestBlock(
  expectRows: ExpectUiRow[],
  requireRows: ExpectUiRow[],
): ApiTestBlock | undefined {
  const expectMap = uiRowsToExpectMap(expectRows);
  const requireMap = uiRowsToExpectMap(requireRows);
  if (!expectMap && !requireMap) {
    return undefined;
  }
  const block: ApiTestBlock = {};
  if (expectMap) {
    block.expect = expectMap as ApiTestBlock["expect"];
  }
  if (requireMap) {
    block.require = requireMap as ApiTestBlock["require"];
  }
  return block;
}

const ApiTestsEditor: React.FC<ApiTestsEditorProps> = ({
  test,
  onChange,
  results,
  fieldSuggestions,
}) => {
  const expectList = React.useMemo(() => expectMapToUiRows(test?.expect as any), [test?.expect]);
  const requireList = React.useMemo(() => expectMapToUiRows(test?.require as any), [test?.require]);

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

  const emit = (nextExpect?: ExpectUiRow[], nextRequire?: ExpectUiRow[]) => {
    onChange(buildTestBlock(nextExpect ?? expectList, nextRequire ?? requireList));
  };

  const resultByComparison = React.useMemo(() => {
    const map = new Map<string, ApiTestExpectItem>();
    for (const item of results || []) {
      map.set(`${item.level}:${item.comparison}`, item);
    }
    return map;
  }, [results]);

  const resultForRow = (level: "expect" | "require", row: ExpectUiRow): ApiTestExpectItem | undefined => {
    if (!results || results.length === 0) {
      return undefined;
    }
    // Prefer matching by comparison string built the same way as evaluation.
    const op = row.explicitOperator || row.op !== "==" ? row.op : "==";
    const comparison = `${row.field} ${op} ${row.expected}`;
    return resultByComparison.get(`${level}:${comparison}`) ||
        results.find(r => r.level === level && r.comparison.startsWith(`${row.field} `));
  };

  const resultIcon = (level: "expect" | "require", row: ExpectUiRow) => {
    const result = resultForRow(level, row);
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
        {failed ? <span className="codicon codicon-error" /> : null}
      </span>
    );
  };

  const summary = React.useMemo(() => {
    if (!results || results.length === 0) {
      return null;
    }
    const passed = results.filter(r => r.status === "passed").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { passed, failed, total: results.length };
  }, [results]);

  return (
    <div className="apitest-tests">
      {summary && (
        <div className="apitest-tests-summary muted">
          {summary.passed} passed, {summary.failed} failed
        </div>
      )}
      <CheckClauseList
        kind="expect"
        rows={expectList}
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
            {resultIcon("expect", row)}
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
      <CheckClauseList
        kind="require"
        rows={requireList}
        onPartChange={(index, part, val) => {
          const updated = requireList.map((row, i) => (
            i === index ? applyExpectUiRowChange(row, part, val) : row
          ));
          emit(undefined, updated);
        }}
        onRemove={(index) => emit(undefined, requireList.filter((_, i) => i !== index))}
        onAdd={() => {
          const defaultField = requireList.length > 0
            ? requireList[requireList.length - 1].field
            : (suggestions[0] || "status");
          emit(undefined, [...requireList, createEmptyExpectUiRow(defaultField)]);
        }}
        renderField={(row, i) => (
          <>
            {resultIcon("require", row)}
            <CheckClauseFieldInput
              list="apitest-require-fields"
              value={row.field}
              onChange={val => {
                const updated = requireList.map((r, idx) => (
                  idx === i ? applyExpectUiRowChange(r, "field", val) : r
                ));
                emit(undefined, updated);
              }}
              title="Output field"
              placeholder="status"
            />
          </>
        )}
      >
        <datalist id="apitest-require-fields">
          {suggestions.map(field => (
            <option key={field} value={field} />
          ))}
        </datalist>
      </CheckClauseList>
    </div>
  );
};

export default ApiTestsEditor;
