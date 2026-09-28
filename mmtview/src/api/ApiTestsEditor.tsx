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
  /** Suggested field names (e.g. declared outputs). */
  fieldSuggestions?: string[];
  /** When true, show empty-state copy for no tests (SDD: no blue link). */
  showEmptyState?: boolean;
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
  showEmptyState = true,
}) => {
  const expectList = React.useMemo(() => expectMapToUiRows(test?.expect as any), [test?.expect]);
  const requireList = React.useMemo(() => expectMapToUiRows(test?.require as any), [test?.require]);

  const suggestions = React.useMemo(() => {
    const set = new Set<string>([...DEFAULT_FIELDS, ...(fieldSuggestions || [])]);
    return Array.from(set);
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

  const hasAnyRows = expectList.length > 0 || requireList.length > 0;
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
      {!hasAnyRows && showEmptyState && !summary ? (
        <div className="apitest-empty">No tests on this example.</div>
      ) : null}
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
            {(() => {
              const result = resultForRow("expect", row);
              if (!result) {
                return null;
              }
              const ok = result.status === "passed";
              return (
                <span
                  className={`codicon ${ok ? "codicon-check" : "codicon-error"} no-shrink`}
                  style={{ color: ok ? "var(--vscode-testing-iconPassed)" : "var(--vscode-testing-iconFailed)" }}
                  title={ok ? "Passed" : "Failed"}
                  aria-label={ok ? "Passed" : "Failed"}
                />
              );
            })()}
            <CheckClauseFieldInput
              list="apitest-test-fields"
              value={row.field}
              onChange={val => {
                const updated = expectList.map((r, idx) => (
                  idx === i ? applyExpectUiRowChange(r, "field", val) : r
                ));
                emit(updated);
              }}
              title="Output field"
              placeholder="field"
            />
          </>
        )}
      />
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
            {(() => {
              const result = resultForRow("require", row);
              if (!result) {
                return null;
              }
              const ok = result.status === "passed";
              return (
                <span
                  className={`codicon ${ok ? "codicon-check" : "codicon-error"} no-shrink`}
                  style={{ color: ok ? "var(--vscode-testing-iconPassed)" : "var(--vscode-testing-iconFailed)" }}
                  title={ok ? "Passed" : "Failed"}
                  aria-label={ok ? "Passed" : "Failed"}
                />
              );
            })()}
            <CheckClauseFieldInput
              list="apitest-test-fields"
              value={row.field}
              onChange={val => {
                const updated = requireList.map((r, idx) => (
                  idx === i ? applyExpectUiRowChange(r, "field", val) : r
                ));
                emit(undefined, updated);
              }}
              title="Output field"
              placeholder="field"
            />
          </>
        )}
      />
      <datalist id="apitest-test-fields">
        {suggestions.map(f => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
};

export default ApiTestsEditor;
