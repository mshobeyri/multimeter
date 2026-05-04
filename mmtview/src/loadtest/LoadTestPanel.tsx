import React, { useMemo } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';

interface LoadTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 8,
  padding: 16,
  background: 'var(--vscode-editorWidget-background)',
};

const mutedStyle: React.CSSProperties = {
  opacity: 0.8,
  fontSize: 13,
};

const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ content }) => {
  const parsed = useMemo(() => {
    try {
      return parseYaml(content) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [content]);

  const title = typeof parsed?.title === 'string' ? parsed.title : 'Load Test';
  const target = typeof parsed?.test === 'string' ? parsed.test : 'No test selected';
  const threads = typeof parsed?.threads === 'number' ? String(parsed.threads) : 'Not set';
  const repeat = parsed?.repeat != null ? String(parsed.repeat) : 'Not set';
  const rampup = typeof parsed?.rampup === 'string' ? parsed.rampup : 'Not set';

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <div className="api-edit-title" style={{ marginBottom: 8 }}>{title}</div>
          <div style={mutedStyle}>Load tests run one referenced type: test file with load configuration from the YAML editor.</div>
        </div>
        <div style={cardStyle}>
          <div className="label" style={{ marginBottom: 8 }}>Configuration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, columnGap: 12 }}>
            <div style={mutedStyle}>Test</div>
            <div>{target}</div>
            <div style={mutedStyle}>Threads</div>
            <div>{threads}</div>
            <div style={mutedStyle}>Repeat</div>
            <div>{repeat}</div>
            <div style={mutedStyle}>Ramp-up</div>
            <div>{rampup}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadTestPanel;
