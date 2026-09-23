import React from "react";
import { FlowType, CheckOps } from "mmt-core/TestData";
import { KebabMenu } from "../components/PopupMenu";
import { formatLogicalCondition, parseComparisonParts, parseLogicalCondition, type LogicalJoin } from "mmt-core/JSerTestFlow";
import TestCheck, { ReportValue } from "./TestCheck";
import TestCall from "./TestCall";
import TestJudge from "./TestJudge";
import TestHttp from "./TestHttp";
import TestFlowVar from "./TestFlowVar";
import TestFlowCSV from "./TestFlowCSV";
import { type MissingImportEntry } from "../text/validator";
import TestIf, { type IfClause } from "./TestIf";
import KSVEditor from "../components/KSVEditor";

function clauseFromRaw(raw: string): IfClause {
  const parsed = parseComparisonParts(raw);
  if (parsed) {
    return {
      actual: parsed.actual,
      op: (parsed.operator as CheckOps) || "==",
      expected: parsed.expected,
    };
  }
  const match = raw.trim().length ? raw.trim().split(/\s+/) : [] as string[];
  return {
    actual: match[0] ?? "",
    op: (match[1] as CheckOps) ?? "==",
    expected: match.slice(2).join(" ") || "",
  };
}

function parseIfForUi(raw: string): { first: IfClause; join?: LogicalJoin; second?: IfClause } {
  const { clauses, joins } = parseLogicalCondition(raw);
  if (clauses.length === 0) {
    return { first: { actual: "", op: "==", expected: "" } };
  }
  const first = clauseFromRaw(clauses[0]);
  if (clauses.length === 1) {
    return { first };
  }
  // UI supports one join (second condition). Extra clauses stay on the second expected side.
  const join = joins[0] || "&&";
  const rest = clauses.slice(1).map((c, i) => {
    if (i === 0) {
      return c;
    }
    return `${joins[i] || "&&"} ${c}`;
  }).join(" ");
  return { first, join, second: clauseFromRaw(rest) };
}

/** Counts become numbers; durations like 1s stay strings. */
export function coerceRepeatOrDelayValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function formatIfForUi(val: { first: IfClause; join?: LogicalJoin; second?: IfClause }): string {
  const clauses = [
    { actual: val.first.actual, operator: val.first.op, expected: val.first.expected },
  ];
  const joins: LogicalJoin[] = [];
  if (val.second) {
    clauses.push({
      actual: val.second.actual,
      operator: val.second.op,
      expected: val.second.expected,
    });
    joins.push(val.join || "&&");
  }
  return formatLogicalCondition(clauses, joins);
}

interface TestFlowBoxProps {
  data: any,
  onChange: (value: any) => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  importValidation?: {
    missingImports: MissingImportEntry[];
    inputsByAlias: Record<string, string[]>;
    outputsByAlias?: Record<string, string[]>;
  };
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({
  data,
  onChange,
  expandable,
  expanded,
  onToggleExpanded,
  onDuplicate,
  onRemove,
  importValidation,
}) => {
  const { type, stepData, testData } = data;

  type FlowTypeWithCsv = FlowType | 'data' | 'else';
  const renderInner = () => {
    switch (type as FlowTypeWithCsv) {
      case 'call':
        return (
          <TestCall
            value={stepData}
            imports={testData?.import && typeof testData.import === 'object' ? (Object.fromEntries(Object.entries(testData.import).filter(([_, p]) => {
              if (typeof p !== 'string') {
                return false;
              }
              const lower = p.toLowerCase();
              return lower.endsWith('.mmt') || lower.endsWith('.http') || lower.endsWith('.https') || lower.endsWith('.bru') || lower.endsWith('.bruno');
            })) as Record<string, string>) : undefined}
            missingImports={importValidation?.missingImports}
            importedInputsByAlias={importValidation?.inputsByAlias}
            importedOutputsByAlias={importValidation?.outputsByAlias}
            onChange={callObj => onChange({ ...callObj })}
            placeholder="select a call"
          />
        );
      case 'judge':
        return (
          <TestJudge
            value={stepData}
            expanded={expanded}
            imports={typeof testData?.import === 'object' ? testData.import as Record<string, string> : undefined}
            onChange={judgeObj => onChange({ ...judgeObj })}
          />
        );
      case 'http':
        return (
          <TestHttp
            value={stepData}
            expanded={expanded}
            onChange={httpObj => onChange({ ...httpObj })}
          />
        );
      case 'data':
        return (
          <TestFlowCSV
            value={stepData}
            imports={typeof testData?.import === 'object' ? testData.import : undefined}
            onChange={(v) => onChange(v)}
          />
        );
      case 'if': {
        const raw = (stepData && typeof stepData[type] === 'string') ? (stepData[type] as string) : '';
        const parsed = parseIfForUi(raw);
        if (!expanded && parsed.second) {
          return (
            <input
              value={raw}
              onChange={e => onChange({
                ...stepData,
                [type]: e.target.value,
              })}
              placeholder="(actual == expected && other != 0 | actual == expected || other == 1)"
              className="mmt-fill"
            />
          );
        }
        return (
          <TestIf
            first={parsed.first}
            join={parsed.join}
            second={parsed.second}
            expanded={expanded}
            onChange={(val) => onChange({
              ...stepData,
              [type]: formatIfForUi(val),
            })}
          />
        );
      }
      case 'else':
        return (
          <div className="test-flow-else">
            else
          </div>
        );
      case 'check':
      case 'assert': {
        let actual = '', op: CheckOps = '==' as CheckOps, expected = '', title = '', details = '';
        let report: ReportValue = undefined;
        const rawVal = stepData && stepData[type];
        if (typeof rawVal === 'string') {
          const match = rawVal.trim().length ? rawVal.trim().split(/\s+/) : [] as string[];
          actual = match[0] ?? '';
          op = (match[1] as CheckOps) ?? '==';
          expected = match[2] ?? '';
        } else if (rawVal && typeof rawVal === 'object') {
          actual = (rawVal as any).actual ?? '';
          expected = (rawVal as any).expected ?? '';
          op = ((rawVal as any).operator || '==') as CheckOps;
          title = (rawVal as any).title || '';
          details = (rawVal as any).details || '';
          report = (rawVal as any).report;
        }
        return (
          <TestCheck
              value={{ actual, op, expected, title, details, report }}
              expanded={expanded}
              onChange={({ actual, op, expected, title, details, report }) => {
                const obj: any = { actual, expected, operator: op || '==', };
              if (title.trim().length > 0) {
                obj.title = title.trim();
              }
              if (details.trim().length > 0) {
                obj.details = details.trim();
              }
              if (report !== undefined) {
                obj.report = report;
              }
              onChange({ [type]: obj });
            }}
          />
        );
      }
      case 'for':
        return (
          <input
            placeholder="(i = 0; i < 5; i++ | key in obj | item of list)"
            value={stepData.for || ''}
            onChange={e => onChange({ ...stepData, for: e.target.value })}
            className="mmt-fill"
          />
        );
      case 'repeat':
      case 'delay':
        return (
          <input
            placeholder={type === 'delay' ? '(1ms | 2s | 3m | 4h)' : '(100 | 2s | 3m | 4h)'}
            value={stepData[type] != null ? String(stepData[type]) : ''}
            onChange={e => onChange({ ...stepData, [type]: coerceRepeatOrDelayValue(e.target.value) })}
            className="mmt-fill"
          />
        );
      case 'js':
        return (
          <textarea
            className="test-flow-js"
            placeholder="JavaScript code"
            value={stepData[type] || ''}
            onChange={e => onChange({ js: e.target.value })}
            style={{ height: expanded ? 400 : 24 }}
          />
        );
      case 'print':
        return (
          <textarea
            className="test-flow-js"
            placeholder="Message to print"
            value={stepData[type] || ''}
            onChange={e => onChange({ print: e.target.value })}
            style={{ height: expanded ? 400 : 24 }}
          />
        );
      case 'set':
      case 'var':
      case 'const':
      case 'let':
        return (
          <TestFlowVar
            type={type as 'set' | 'var' | 'const' | 'let'}
            stepData={stepData}
            onChange={onChange}
          />
        );
      case 'setenv': {
        const current = (stepData && typeof stepData === 'object') ? (stepData as any).setenv : undefined;
        return (
          <div className="mmt-fill">
            {expanded && (
              <KSVEditor
                label=""
                value={current}
                onChange={(kv) => {
                  onChange({ setenv: kv });
                }}
                keyPlaceholder="name"
                valuePlaceholder="value"
                expandable={true}
              />
            )}
            {!expanded && (
              <div className="test-flow-setenv-count">
                {(current && typeof current === 'object') ? `${Object.keys(current).length} item(s)` : '0 item(s)'}
              </div>
            )}
          </div>
        );
      }
      case 'steps':
      case 'stages':
        return null;
      case 'run':
        return (
          <input
            placeholder="mock server file (e.g. mock/server.mmt)"
            value={stepData[type] || ''}
            onChange={e => onChange({ [type]: e.target.value })}
            className="mmt-fill"
          />
        );
      case 'stage': {
        const idVal = typeof stepData?.id === 'string' ? stepData.id : '';
        const condVal = typeof stepData?.condition === 'string' ? stepData.condition : '';
        const deps = Array.isArray(stepData?.after)
          ? stepData.after as string[]
          : (stepData?.after ? [String(stepData.after)] : []);
        const depsStr = deps.join(', ');
        const updateStage = (patch: Partial<{ id: string; condition: string; after: string[] }>) => {
          const next = { ...(stepData || {}), ...patch } as any;
          onChange(next);
        };
        return (
          <div className="mmt-fill">
            <input
              className="mmt-fill"
              placeholder="id"
              value={idVal}
              onChange={e => updateStage({ id: e.target.value })}
            />
            {expanded && (
              <>
                <div className="label">Condition</div>
                <div className="field-pad">
                  <input
                    placeholder="e.g. e:RUN_PREP == true"
                    value={condVal}
                    onChange={e => updateStage({ condition: e.target.value })}
                  />
                </div>
                <div className="label">Depends on</div>
                <div className="field-pad">
                  <input
                    placeholder="comma-separated stage ids"
                    value={depsStr}
                    onChange={e => updateStage({ after: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  />
                </div>
              </>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="test-flow-box-items">
      <span className="test-flow-type-label">
        {type}
      </span>
      <div className="test-flow-box-body">
        {renderInner()}
      </div>
      <div className="test-flow-box-actions">
        {expandable && (
          <button
            className={["action-button", "test-flow-expand", expanded ? "is-pressed" : undefined].filter(Boolean).join(" ")}
            type="button"
            title={expanded ? "Collapse" : "Expand"}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-pressed={!!expanded}
            draggable={false}
            tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              onToggleExpanded?.();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleExpanded?.();
              }
            }}
          >
            <span className="codicon codicon-settings" aria-hidden />
          </button>
        )}
        {type !== 'else' ? (
          <KebabMenu
            menuClassName="test-flow-add-menu"
            items={[
              { label: "Duplicate", icon: "codicon-copy", onClick: () => onDuplicate?.() },
              { label: "Remove", icon: "codicon-trash", onClick: () => onRemove?.() },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
};

export default TestFlowBox;