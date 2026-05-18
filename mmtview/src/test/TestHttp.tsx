import React from "react";
import { opsList, ReportConfig, ReportLevel } from "mmt-core/TestData";
import KSVEditor from "../components/KSVEditor";
import OperatorSelect from "../components/OperatorSelect";

interface ExpectRow {
  field: string;
  op: string;
  expected: string;
}

interface TestHttpProps {
  value: any;
  onChange: (value: any) => void;
  expanded?: boolean;
}

const methodOptions = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const formatOptions = ['json', 'xml', 'xmle', 'text'];
const responseFields = ['status', 'body.message', 'body', 'headers', 'cookies', 'duration'];
const reportLevelOptions: ReportLevel[] = ['all', 'fails', 'none'];

const expectMapToRows = (map: Record<string, any> | undefined): ExpectRow[] => {
  if (!map || typeof map !== 'object') {
    return [];
  }
  const rows: ExpectRow[] = [];
  for (const [field, val] of Object.entries(map)) {
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) {
      const s = String(v ?? '').trim();
      let matched = false;
      for (const op of opsList) {
        if (s.startsWith(op + ' ') || s === op) {
          rows.push({ field, op, expected: s.slice(op.length).trim() });
          matched = true;
          break;
        }
      }
      if (!matched) {
        rows.push({ field, op: '==', expected: s });
      }
    }
  }
  return rows;
};

const rowsToExpectMap = (rows: ExpectRow[]): Record<string, any> | undefined => {
  if (rows.length === 0) {
    return undefined;
  }
  const map: Record<string, any> = {};
  for (const row of rows) {
    const entry = row.op === '==' ? row.expected : `${row.op} ${row.expected}`;
    if (map[row.field] !== undefined) {
      if (Array.isArray(map[row.field])) {
        map[row.field].push(entry);
      } else {
        map[row.field] = [map[row.field], entry];
      }
    } else {
      map[row.field] = entry;
    }
  }
  return map;
};

const TestHttp: React.FC<TestHttpProps> = ({ value, onChange, expanded }) => {
  const step = value && typeof value === 'object' ? value : {};
  const expectList = React.useMemo(() => expectMapToRows(step.expect), [step.expect]);
  const callReport = step.report;
  const isReportObjectForm = callReport && typeof callReport === 'object';
  const reportInternalValue: ReportLevel = isReportObjectForm
    ? (callReport as ReportConfig).internal ?? 'all'
    : (typeof callReport === 'string' ? callReport as ReportLevel : 'all');
  const reportExternalValue: ReportLevel = isReportObjectForm
    ? (callReport as ReportConfig).external ?? 'fails'
    : (typeof callReport === 'string' ? callReport as ReportLevel : 'fails');

  const emit = (patch: Record<string, any>, nextExpect?: ExpectRow[], nextReport?: any) => {
    const next: any = {
      ...step,
      ...patch,
      http: patch.http !== undefined ? patch.http : (step.http || ''),
      method: patch.method !== undefined ? patch.method : (step.method || 'get'),
      format: patch.format !== undefined ? patch.format : (step.format || 'json'),
    };
    if (!next.headers || Object.keys(next.headers).length === 0) {
      delete next.headers;
    }
    if (!next.query || Object.keys(next.query).length === 0) {
      delete next.query;
    }
    if (!next.id || !String(next.id).trim()) {
      delete next.id;
    }
    if (!next.title || !String(next.title).trim()) {
      delete next.title;
    }
    if (next.body === '' || next.body === undefined) {
      delete next.body;
    }
    const expectMap = rowsToExpectMap(nextExpect ?? expectList);
    if (expectMap) {
      next.expect = expectMap;
    } else {
      delete next.expect;
    }
    const report = nextReport !== undefined ? nextReport : callReport;
    if (report !== undefined) {
      next.report = report;
    } else {
      delete next.report;
    }
    onChange(next);
  };

  const handleReportChange = (internal: ReportLevel, external: ReportLevel) => {
    let report: any;
    if (internal === 'all' && external === 'fails') {
      report = undefined;
    } else if (internal === external) {
      report = internal;
    } else {
      report = { internal, external };
    }
    emit({}, undefined, report);
  };

  const handleAddExpect = () => {
    emit({}, [...expectList, { field: 'body.message', op: '==', expected: '' }]);
  };

  const handleRemoveExpect = (index: number) => {
    emit({}, expectList.filter((_, i) => i !== index));
  };

  const handleExpectPartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = expectList.map((row, i) => i === index ? { ...row, [part]: val } : row);
    emit({}, updated);
  };

  const selectedMethod = String(step.method || 'get').toLowerCase();

  return (
    <div style={{ width: '100%', borderCollapse: "collapse", tableLayout: "fixed" }}>
      <div>
        <input
          type="text"
          value={step.http || ''}
          onChange={e => emit({ http: e.target.value })}
          style={{ width: '100%' }}
          placeholder="URL"
        />
      </div>
      {expanded && (
        <>
          <div className="label">Id</div>
          <div style={{ padding: "5px" }}>
            <input
              type="text"
              value={step.id || ''}
              onChange={e => emit({ id: e.target.value })}
              style={{ width: '100%' }}
              placeholder="Optional id to capture response"
            />
          </div>

          <div className="label">Title</div>
          <div style={{ padding: "5px" }}>
            <input
              type="text"
              value={step.title || ''}
              onChange={e => emit({ title: e.target.value })}
              style={{ width: '100%' }}
              placeholder="Optional display title"
            />
          </div>

          <div className="label">Method</div>
          <div style={{ padding: "5px" }}>
            <select
              value={selectedMethod}
              onChange={e => emit({ method: e.target.value })}
              style={{ width: '100%' }}
            >
              {methodOptions.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className="label">Format</div>
          <div style={{ padding: "5px" }}>
            <select
              value={step.format || 'json'}
              onChange={e => emit({ format: e.target.value })}
              style={{ width: '100%' }}
            >
              {formatOptions.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>

          <KSVEditor
            label="Headers"
            value={step.headers || {}}
            onChange={headers => emit({ headers })}
          />

          <KSVEditor
            label="Query"
            value={step.query || {}}
            onChange={query => emit({ query })}
          />

          {selectedMethod !== 'get' && (
            <>
              <div className="label">Body</div>
              <div style={{ padding: "5px" }}>
                <textarea
                  value={typeof step.body === 'string' ? step.body : JSON.stringify(step.body || '', null, 2)}
                  onChange={e => emit({ body: e.target.value })}
                  style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
                  placeholder="Request body"
                />
              </div>
            </>
          )}

          <div className="label">Expect</div>
          <div style={{ padding: "5px" }}>
            <datalist id="http-response-fields">
              {responseFields.map(field => (
                <option key={field} value={field} />
              ))}
            </datalist>
            {expectList.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expectList.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      list="http-response-fields"
                      value={row.field}
                      onChange={e => handleExpectPartChange(i, 'field', e.target.value)}
                      style={{ flex: 2, minWidth: 0 }}
                      title="Response path to check"
                      placeholder="body.message"
                    />
                    <OperatorSelect
                      value={row.op as any}
                      onChange={nextOp => handleExpectPartChange(i, 'op', nextOp)}
                      style={{ flex: 1, minWidth: 0 }}
                      title="Comparison operator"
                    />
                    <input
                      type="text"
                      value={row.expected}
                      onChange={e => handleExpectPartChange(i, 'expected', e.target.value)}
                      style={{ flex: 2, minWidth: 0 }}
                      placeholder="expected value"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExpect(i)}
                      className="action-button codicon codicon-close"
                      style={{ flexShrink: 0 }}
                      title="Remove expect"
                      aria-label="Remove expect"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No expectations</div>
            )}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={handleAddExpect}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px dashed var(--vscode-editorWidget-border, #555)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                + Add expect
              </button>
            </div>
          </div>

          {expectList.length > 0 && (
            <>
          <div className="label">Report</div>
          <div style={{ padding: '5px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label title="Report level when running this test directly" style={{ userSelect: 'none', fontSize: 12 }}>
                Internal:
              </label>
              <select
                value={reportInternalValue}
                onChange={e => handleReportChange(e.target.value as ReportLevel, reportExternalValue)}
                style={{ fontSize: 12 }}
              >
                {reportLevelOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label title="Report level when this test is imported or added to a suite" style={{ userSelect: 'none', fontSize: 12 }}>
                External:
              </label>
              <select
                value={reportExternalValue}
                onChange={e => handleReportChange(reportInternalValue, e.target.value as ReportLevel)}
                style={{ fontSize: 12 }}
              >
                {reportLevelOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TestHttp;
