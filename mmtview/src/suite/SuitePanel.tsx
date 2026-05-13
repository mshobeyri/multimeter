import React, { useMemo, useState } from 'react';
import 'react-complex-tree/lib/style.css';
import SuiteEdit from './edit/SuiteEdit';
import SuiteTest, { SuiteFlowchartState } from './test/SuiteTest';
import { parseYaml } from 'mmt-core/markupConvertor';
import { FlowchartView } from '../flowchart';
import { FileContext } from '../fileContext';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

type SuitePage = 'test' | 'edit' | 'flow';
const EMPTY_MISSING_FILES = new Set<string>();

function pageTranslate(page: SuitePage): string {
  if (page === 'edit') {
    return 'translateX(-33.333333%)';
  }
  if (page === 'flow') {
    return 'translateX(-66.666667%)';
  }
  return 'translateX(0%)';
}

const SuitePanel: React.FC<SuitePanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<SuitePage>('test');
  const [flowchartState, setFlowchartState] = useState<SuiteFlowchartState | null>(null);
  const { mmtFilePath } = React.useContext(FileContext);
  const suiteTitle = useMemo(() => {
    const parsed = parseYaml(content);
    return (parsed && typeof parsed.title === 'string') ? parsed.title : 'Suite';
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
                      <span className="codicon codicon-layers" aria-hidden />
                      {suiteTitle}
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
                        title="Edit Suite"
                        type="button"
                      >
                        <span className="codicon codicon-edit" aria-hidden />
                        <span className="api-edit-launcher-text">Edit Suite</span>
                      </button>
                    </div>
                  </div>
                </div>
                <SuiteTest
                  content={content}
                  onFlowchartStateChange={setFlowchartState}
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

            <div className="api-swipe-page api-swipe-page--flow">
              <FlowchartView
                source={{
                  kind: 'suite',
                  rootTitle: suiteTitle,
                  rootPath: mmtFilePath,
                  groups: flowchartState?.groups ?? [],
                  hierarchyByEntryPath: flowchartState?.hierarchyByEntryPath ?? {},
                  missingFiles: flowchartState?.missingFiles ?? EMPTY_MISSING_FILES,
                }}
                onBack={() => setPage('test')}
                title={suiteTitle || 'Suite'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuitePanel;
