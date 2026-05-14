import React, { useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import SuiteTest, { SuiteFlowchartState } from '../suite/test/SuiteTest';
import LoadTestEdit from './LoadTestEdit';
import { FlowchartView } from '../flowchart';
import { FileContext } from '../fileContext';

interface LoadTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

type LoadTestPage = 'test' | 'edit' | 'flow';
const EMPTY_MISSING_FILES = new Set<string>();

function pageTranslate(page: LoadTestPage): string {
  if (page === 'edit') {
    return 'translateX(-33.333333%)';
  }
  if (page === 'flow') {
    return 'translateX(-66.666667%)';
  }
  return 'translateX(0%)';
}

const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<LoadTestPage>('test');
  const [flowchartState, setFlowchartState] = useState<SuiteFlowchartState | null>(null);
  const { mmtFilePath } = React.useContext(FileContext);
  const loadTestTitle = useMemo(() => {
    const parsed = parseYaml(content);
    return (parsed && typeof parsed.title === 'string') ? parsed.title : 'Load Test';
  }, [content]);

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track api-swipe-track--three"
            style={{ transform: pageTranslate(page) }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: 'flex', minWidth: 0, overflow: 'hidden', flexDirection: 'column' }}>
                <div className="api-edit-header">
                  <div className="tab-bar tab-bar-single" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="tab-button active" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="codicon codicon-dashboard" aria-hidden />
                      {loadTestTitle}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="action-button api-edit-launcher"
                        onClick={() => setPage('flow')}
                        title="Flow chart"
                        type="button"
                        disabled={Boolean(flowchartState?.noItems)}
                      >
                        <span className="codicon codicon-type-hierarchy-sub" aria-hidden />
                        <span className="api-edit-launcher-text">Flow chart</span>
                      </button>
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
                </div>
                <SuiteTest content={content} mode="loadtest" onFlowchartStateChange={setFlowchartState} />
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

            <div className="api-swipe-page api-swipe-page--flow">
              <FlowchartView
                source={{
                  kind: 'suite',
                  rootTitle: loadTestTitle,
                  rootPath: mmtFilePath,
                  groups: flowchartState?.groups ?? [],
                  hierarchyByEntryPath: flowchartState?.hierarchyByEntryPath ?? {},
                  missingFiles: flowchartState?.missingFiles ?? EMPTY_MISSING_FILES,
                }}
                onBack={() => setPage('test')}
                title={loadTestTitle || 'Load Test'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadTestPanel;
