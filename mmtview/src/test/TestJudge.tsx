import React from 'react';
import { ReportLevel, ReportConfig } from 'mmt-core/TestData';
import { JSONRecord } from 'mmt-core/CommonData';
import { JUDGE_BUILTIN_CHECKS } from 'mmt-core/judgeChecks';
import KVEditor from '../components/KVEditor';
import LEditor from '../components/LEditor';

interface TestJudgeProps {
  value: any;
  imports?: Record<string, string>;
  onChange: (value: any) => void;
}

function metricsMapFromBlock(block: any): JSONRecord {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return {};
  }
  const out: JSONRecord = {};
  for (const [name, value] of Object.entries(block)) {
    if (name === 'criteria') {
      continue;
    }
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      out[name] = value;
    } else if (value && typeof value === 'object' && typeof (value as any).threshold === 'number') {
      out[name] = (value as any).threshold;
    } else if (value != null) {
      out[name] = String(value);
    }
  }
  return out;
}

function criteriaListFromBlock(block: any): string[] {
  if (!block || typeof block !== 'object' || !Array.isArray(block.criteria)) {
    return [];
  }
  return block.criteria.map((c: any) => String(c ?? '')).filter((c: string) => c.trim() !== '');
}

function buildEvalBlock(metrics: JSONRecord, criteria: string[]): any | undefined {
  const out: Record<string, any> = {};
  for (const [name, value] of Object.entries(metrics || {})) {
    const key = String(name || '').trim();
    if (!key) {
      continue;
    }
    out[key] = value;
  }
  const crit = (criteria || []).map((c) => String(c ?? '').trim()).filter(Boolean);
  if (crit.length > 0) {
    out.criteria = crit;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const MetricPresets: React.FC<{
  metrics: JSONRecord;
  onAdd: (id: string, threshold: number) => void;
}> = ({ metrics, onAdd }) => (
  <div className="judge-metric-presets">
    {JUDGE_BUILTIN_CHECKS.map((check) => {
      const present = Object.prototype.hasOwnProperty.call(metrics, check.id);
      return (
        <button
          key={check.id}
          type="button"
          className={`judge-metric-chip${present ? ' judge-metric-chip--on' : ''}`}
          disabled={present}
          title={check.description}
          onClick={() => onAdd(check.id, check.defaultThreshold)}
        >
          {check.id}
        </button>
      );
    })}
  </div>
);

const TestJudge: React.FC<TestJudgeProps> = ({ value, imports, onChange }) => {
  const [local, setLocal] = React.useState<any>(typeof value === 'object' && value ? value : null);
  const emitTimerRef = React.useRef<number | null>(null);
  const localRef = React.useRef<any>(local);
  React.useEffect(() => { localRef.current = local; }, [local]);

  const scheduleEmit = (next: any) => {
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current);
    }
    emitTimerRef.current = window.setTimeout(() => {
      onChange(next);
    }, 160);
  };

  React.useEffect(() => {
    if (value && typeof value === 'object' && value !== localRef.current) {
      setLocal(value);
    }
  }, [value]);

  const judgeImports = React.useMemo(() => {
    if (!imports) {
      return {};
    }
    return Object.fromEntries(
        Object.entries(imports).filter(([_, p]) =>
          typeof p === 'string' && p.toLowerCase().endsWith('.mmt')));
  }, [imports]);

  const aliases = Object.keys(judgeImports);
  const currentAlias = local && typeof local === 'object' && typeof local.judge === 'string'
      ? local.judge
      : (value && typeof value === 'object' && typeof value.judge === 'string' ? value.judge : '');
  const currentId = local && typeof local === 'object' && typeof local.id === 'string' ? local.id : '';
  const currentTitle = local && typeof local === 'object' && typeof local.title === 'string' ? local.title : '';

  const expectMetrics = React.useMemo(
      () => metricsMapFromBlock(local?.expect), [local]);
  const expectCriteria = React.useMemo(
      () => criteriaListFromBlock(local?.expect), [local]);
  const requireMetrics = React.useMemo(
      () => metricsMapFromBlock(local?.require), [local]);
  const requireCriteria = React.useMemo(
      () => criteriaListFromBlock(local?.require), [local]);

  const buildObj = (patch: Record<string, any>) => {
    const base = (local && typeof local === 'object') ? { ...local } : {};
    const next = { ...base, ...patch };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === null) {
        delete next[k];
      }
    }
    if (!next.judge) {
      next.judge = currentAlias || '';
    }
    return next;
  };

  const emit = (next: any) => {
    setLocal(next);
    scheduleEmit(next);
  };

  const addExpectMetric = (id: string, threshold: number) => {
    emit(buildObj({
      expect: buildEvalBlock({ ...expectMetrics, [id]: threshold }, expectCriteria),
    }));
  };

  const addRequireMetric = (id: string, threshold: number) => {
    emit(buildObj({
      require: buildEvalBlock({ ...requireMetrics, [id]: threshold }, requireCriteria),
    }));
  };

  const report = local && typeof local === 'object' ? local.report : undefined;
  const isReportObject = report && typeof report === 'object';
  const reportInternal: ReportLevel = isReportObject
      ? (report as ReportConfig).internal ?? 'all'
      : (typeof report === 'string' ? report as ReportLevel : 'all');
  const reportExternal: ReportLevel = isReportObject
      ? (report as ReportConfig).external ?? 'fails'
      : (typeof report === 'string' ? report as ReportLevel : 'fails');

  const setReport = (internal: ReportLevel, external: ReportLevel) => {
    let rep: any;
    if (internal === 'all' && external === 'fails') {
      rep = undefined;
    } else if (internal === external) {
      rep = internal;
    } else {
      rep = { internal, external };
    }
    emit(buildObj({ report: rep }));
  };

  const reportLevels: ReportLevel[] = ['all', 'fails', 'none'];

  return (
    <div style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <select
        value={aliases.includes(currentAlias) ? currentAlias : ''}
        onChange={(e) => emit(buildObj({ judge: e.target.value }))}
        style={{ width: '100%' }}
      >
        <option value="">{aliases.length ? 'select judge' : 'no judge imports'}</option>
        {aliases.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <div className="label">Id</div>
      <div style={{ padding: '5px' }}>
        <input
          type="text"
          value={currentId}
          onChange={(e) => emit(buildObj({ id: e.target.value }))}
          disabled={!currentAlias}
          style={{ width: '100%' }}
          placeholder="id"
        />
      </div>

      <div className="label">Title</div>
      <div style={{ padding: '5px' }}>
        <input
          type="text"
          value={currentTitle}
          onChange={(e) => emit(buildObj({ title: e.target.value }))}
          disabled={!currentAlias}
          style={{ width: '100%' }}
          placeholder="title"
        />
      </div>

      <KVEditor
        label="Context"
        value={(local?.context || {}) as any}
        onChange={(kv) => emit(buildObj({ context: Object.keys(kv).length ? kv : undefined }))}
        keyPlaceholder="actual"
        valuePlaceholder="${reply}"
      />

      <div className="label" style={{ marginBottom: 0 }}>Expect metrics (soft)</div>
      <div style={{ padding: '4px 5px 0', fontSize: 11, opacity: 0.7 }}>
        Click a built-in check to add it, or type a custom metric name below.
      </div>
      <div style={{ padding: '4px 5px' }}>
        <MetricPresets metrics={expectMetrics} onAdd={addExpectMetric} />
      </div>
      <KVEditor
        label=""
        value={expectMetrics}
        onChange={(kv) => emit(buildObj({ expect: buildEvalBlock(kv, expectCriteria) }))}
        keyPlaceholder="answerRelevance"
        valuePlaceholder="0.8"
      />
      <LEditor
        label="Expect criteria (soft)"
        value={expectCriteria}
        onChange={(list) => emit(buildObj({ expect: buildEvalBlock(expectMetrics, list) }))}
        placeholder="Add criterion..."
      />

      <div className="label" style={{ marginBottom: 0 }}>Require metrics (hard)</div>
      <div style={{ padding: '4px 5px 0', fontSize: 11, opacity: 0.7 }}>
        Hard fail stops the test. Prefer lower thresholds than expect when using the same metric.
      </div>
      <div style={{ padding: '4px 5px' }}>
        <MetricPresets metrics={requireMetrics} onAdd={addRequireMetric} />
      </div>
      <KVEditor
        label=""
        value={requireMetrics}
        onChange={(kv) => emit(buildObj({ require: buildEvalBlock(kv, requireCriteria) }))}
        keyPlaceholder="contextFaithfulness"
        valuePlaceholder="0.5"
      />
      <LEditor
        label="Require criteria (hard)"
        value={requireCriteria}
        onChange={(list) => emit(buildObj({ require: buildEvalBlock(requireMetrics, list) }))}
        placeholder="Add criterion..."
      />

      <div className="label">Report</div>
      <div style={{ display: 'flex', gap: 8, padding: '5px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          internal
          <select
            value={reportInternal}
            onChange={(e) => setReport(e.target.value as ReportLevel, reportExternal)}
          >
            {reportLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          external
          <select
            value={reportExternal}
            onChange={(e) => setReport(reportInternal, e.target.value as ReportLevel)}
          >
            {reportLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
};

export default TestJudge;
