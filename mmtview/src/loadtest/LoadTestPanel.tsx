import React, { useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import SuiteTest from '../suite/test/SuiteTest';
import LoadTestEdit from './LoadTestEdit';

interface LoadTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<'test' | 'edit'>('test');
  const loadTestTitle = useMemo(() => {
    const parsed = parseYaml(content);
    return (parsed && typeof parsed.title === 'string') ? parsed.title : 'Load Test';
  }, [content]);

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: 'flex', minWidth: 0, overflow: 'hidden', flexDirection: 'column' }}>
                <div className="api-edit-header">
                  <div className="tab-bar tab-bar-single" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="tab-button active" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="codicon codicon-dashboard" aria-hidden />
                      {loadTestTitle}
                    </div>
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Load Test"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Load Test</span>
                    </button>
                  </div>
                </div>
                <SuiteTest content={content} mode="loadtest" />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('test')}
                    title="Back to Load Test"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit Load Test</div>
                </div>
              </div>

              <LoadTestEdit content={content} setContent={setContent} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadTestPanel;
