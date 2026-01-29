import React, { useState } from 'react';
import 'react-complex-tree/lib/style.css';
import SuiteEdit from './edit/SuiteEdit';
import SuiteTest from './test/SuiteTest';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

const SuitePanel: React.FC<SuitePanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<'test' | 'edit'>('test');

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: 'flex', minWidth: 0 }}>
                <SuiteTest
                  content={content}
                  rightOfRunButton={(
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Suite"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Suite</span>
                    </button>
                  )}
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('test')}
                    title="Back to Test"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit Suite</div>
                </div>
              </div>

              <SuiteEdit content={content} setContent={setContent} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuitePanel;
