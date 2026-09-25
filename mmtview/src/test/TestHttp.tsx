import React, { useContext } from "react";
import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectMapToUiRows,
  type ExpectUiRow,
  uiRowsToExpectMap,
} from "mmt-core/expectUi";
import { REQUEST_FORMAT_VALUES, RequestFormat, RESPONSE_FORMAT_VALUES, ResponseFormat, requestFormat, responseFormat, packFormatSpec } from "mmt-core/CommonData";
import { resolveRequestFormat } from "mmt-core/formatResolve";
import KSVEditor from "../components/KSVEditor";
import FilePickerInput from "../components/FilePickerInput";
import MultipartPartsEditor from "../components/MultipartPartsEditor";
import CheckClauseList, { CheckClauseFieldInput } from "../components/CheckClauseList";
import ReportLevelFields from "../components/ReportLevelFields";
import { FileContext } from "../fileContext";

interface ExpectRow extends ExpectUiRow {}

interface TestHttpProps {
  value: any;
  onChange: (value: any) => void;
  expanded?: boolean;
}

const methodOptions = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const responseFields = ['status', 'body.message', 'body', 'headers', 'cookies', 'duration'];

const parseTimeoutInput = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const TestHttp: React.FC<TestHttpProps> = ({ value, onChange, expanded }) => {
  const { mmtFilePath } = useContext(FileContext);
  const step = value && typeof value === 'object' ? value : {};
  const expectList = React.useMemo(() => expectMapToUiRows(step.expect), [step.expect]);
  const requireList = React.useMemo(() => expectMapToUiRows(step.require), [step.require]);
  const callReport = step.report;

  const emit = (
      patch: Record<string, any>,
      nextExpect?: ExpectRow[],
      nextRequire?: ExpectRow[],
      nextReport?: any,
  ) => {
    const next: any = {
      ...step,
      ...patch,
      http: patch.http !== undefined ? patch.http : (step.http || ''),
      method: patch.method !== undefined ? patch.method : (step.method || 'get'),
      format: patch.format !== undefined ? patch.format : (step.format || 'json'),
    };
    if (next.timeout === undefined || next.timeout === '' ||
        (typeof next.timeout === 'number' && !Number.isFinite(next.timeout))) {
      delete next.timeout;
    }
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
    const expectMap = uiRowsToExpectMap(nextExpect ?? expectList);
    if (expectMap) {
      next.expect = expectMap;
    } else {
      delete next.expect;
    }
    const requireMap = uiRowsToExpectMap(nextRequire ?? requireList);
    if (requireMap) {
      next.require = requireMap;
    } else {
      delete next.require;
    }
    const report = nextReport !== undefined ? nextReport : callReport;
    if (report !== undefined) {
      next.report = report;
    } else {
      delete next.report;
    }
    onChange(next);
  };

  const handleAddExpect = () => {
    const defaultField = expectList.length > 0
      ? expectList[expectList.length - 1].field
      : 'body.message';
    emit({}, [...expectList, createEmptyExpectUiRow(defaultField)]);
  };

  const handleRemoveExpect = (index: number) => {
    emit({}, expectList.filter((_, i) => i !== index));
  };

  const handleExpectPartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = expectList.map((row, i) => (
      i === index ? applyExpectUiRowChange(row, part, val) : row
    ));
    emit({}, updated);
  };

  const handleAddRequire = () => {
    const defaultField = requireList.length > 0
      ? requireList[requireList.length - 1].field
      : 'status';
    emit({}, undefined, [...requireList, createEmptyExpectUiRow(defaultField)]);
  };

  const handleRemoveRequire = (index: number) => {
    emit({}, undefined, requireList.filter((_, i) => i !== index));
  };

  const handleRequirePartChange = (index: number, part: 'field' | 'op' | 'expected', val: string) => {
    const updated = requireList.map((row, i) => (
      i === index ? applyExpectUiRowChange(row, part, val) : row
    ));
    emit({}, undefined, updated);
  };

  const selectedMethod = String(step.method || 'get').toLowerCase();

  return (
    <div className="mmt-fill">
      <div className="field-pad">
        <input
          type="text"
          value={step.http || ''}
          onChange={e => emit({ http: e.target.value })}
          placeholder="URL"
        />
      </div>
      {expanded && (
        <>
          <div className="label">Id</div>
          <div className="field-pad">
            <input
              type="text"
              value={step.id || ''}
              onChange={e => emit({ id: e.target.value })}
              placeholder="Optional id to capture response"
            />
          </div>

          <div className="label">Title</div>
          <div className="field-pad">
            <input
              type="text"
              value={step.title || ''}
              onChange={e => emit({ title: e.target.value })}
              placeholder="Optional display title"
            />
          </div>

          <div className="label">Method</div>
          <div className="field-pad">
            <select
              value={selectedMethod}
              onChange={e => emit({ method: e.target.value })}
            >
              {methodOptions.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className="label">Timeout (ms)</div>
          <div className="field-pad">
            <input
              type="number"
              min={0}
              step={100}
              value={step.timeout ?? ''}
              onChange={e => emit({ timeout: parseTimeoutInput(e.target.value) })}
              placeholder="Default network timeout"
            />
          </div>

          <div className="label">Request format</div>
          <div className="field-pad">
            <select
              value={requestFormat(step.format)}
              onChange={e => emit({
                format: packFormatSpec({
                  request: e.target.value as RequestFormat,
                  response: responseFormat(step.format),
                }),
              })}
            >
              {REQUEST_FORMAT_VALUES.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>

          <div className="label">Response format</div>
          <div className="field-pad">
            <select
              value={responseFormat(step.format)}
              onChange={e => emit({
                format: packFormatSpec({
                  request: requestFormat(step.format),
                  response: e.target.value as ResponseFormat,
                }),
              })}
            >
              {RESPONSE_FORMAT_VALUES.map(format => (
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

          {resolveRequestFormat(requestFormat(step.format), step.headers, selectedMethod) !== 'none' && (
            <>
              <div className="label">Body</div>
              <div className="field-pad">
                {requestFormat(step.format) === 'binary' ? (
                  <FilePickerInput
                    value={typeof step.body === 'string' ? step.body : ''}
                    basePath={mmtFilePath}
                    showFilePicker
                    placeholder="Relative path to binary file"
                    onChange={path => emit({ body: path })}
                    onEnterPressed={path => emit({ body: path })}
                  />
                ) : requestFormat(step.format) === 'multipart' ? (
                  <MultipartPartsEditor
                    value={step.body}
                    onChange={parts => emit({ body: parts })}
                  />
                ) : (
                  <textarea
                    value={typeof step.body === 'string' ? step.body : JSON.stringify(step.body || '', null, 2)}
                    onChange={e => emit({ body: e.target.value })}
                    placeholder="Request body"
                  />
                )}
              </div>
            </>
          )}

          <CheckClauseList
            kind="expect"
            rows={expectList}
            onPartChange={handleExpectPartChange}
            onRemove={handleRemoveExpect}
            onAdd={handleAddExpect}
            renderField={(row, i) => (
              <CheckClauseFieldInput
                list="http-response-fields"
                value={row.field}
                onChange={val => handleExpectPartChange(i, "field", val)}
                title="Response path to check"
                placeholder="body.message"
              />
            )}
          >
            <datalist id="http-response-fields">
              {responseFields.map(field => (
                <option key={field} value={field} />
              ))}
            </datalist>
          </CheckClauseList>

          <CheckClauseList
            kind="require"
            rows={requireList}
            onPartChange={handleRequirePartChange}
            onRemove={handleRemoveRequire}
            onAdd={handleAddRequire}
            renderField={(row, i) => (
              <CheckClauseFieldInput
                list="http-require-response-fields"
                value={row.field}
                onChange={val => handleRequirePartChange(i, "field", val)}
                title="Response path to require"
                placeholder="status"
              />
            )}
          >
            <datalist id="http-require-response-fields">
              {responseFields.map(field => (
                <option key={field} value={field} />
              ))}
            </datalist>
          </CheckClauseList>

          {(expectList.length > 0 || requireList.length > 0) && (
            <ReportLevelFields
              value={callReport}
              onChange={report => emit({}, undefined, undefined, report)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TestHttp;
