import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ApiTestBlock } from "mmt-core/APIData";
import type { ApiTestExpectItem } from "mmt-core/apiTestEval";
import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectMapToUiRows,
  uiRowsToExpectMap,
} from "mmt-core/expectUi";
import CheckClauseList, {
  newCheckClauseRowId,
  stripCheckClauseRowIds,
  withCheckClauseRowIds,
  type CheckClauseRow,
} from "../components/CheckClauseList";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

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
  /** Suggested field names (e.g. declared outputs) — shown first in the field select. */
  fieldSuggestions?: string[];
  /** Expected values: resolved/token dual-mode when they contain tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
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

const ApiTestsEditor: React.FC<ApiTestsEditorProps> = ({
  test,
  onChange,
  results,
  fieldSuggestions,
  canContainToken = false,
  valueContext,
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
    const op = row.explicitOperator || row.op !== "==" ? row.op : "==";
    const comparison = `${row.field} ${op} ${row.expected}`;
    return resultByComparison.get(comparison) ||
        results.find(r => r.level === "expect" && r.comparison.startsWith(`${row.field} `));
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

  return (
    <div className="apitest-tests">
      <CheckClauseList
        kind="expect"
        rows={rows}
        fieldOptions={fieldOptions}
        canContainToken={canContainToken}
        valueContext={valueContext}
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
