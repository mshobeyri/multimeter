import React from 'react';

interface SuiteTestProps {
  canRun: boolean;
  onRunSuite: () => void;
  tree: React.ReactNode;
  noItems: boolean;
}

const SuiteTest: React.FC<SuiteTestProps> = ({ canRun, onRunSuite, tree, noItems }) => {
  return (
    <div className="panel-box">
      <div className="test-flow-tree" style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            alignItems: 'center',
            position: 'relative',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>Suite Test</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="button-icon"
              disabled={!canRun}
              onClick={onRunSuite}
              title={!canRun ? 'No suite files to run' : 'Run suite'}
            >
              <span className="codicon codicon-run" aria-hidden />
              Run suite
            </button>
          </div>
        </div>
        {noItems ? <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div> : tree}
      </div>
    </div>
  );
};

export default SuiteTest;
