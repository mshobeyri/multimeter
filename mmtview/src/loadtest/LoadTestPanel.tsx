import React, { useEffect, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import SuiteTest, { SuiteFlowchartState } from '../suite/test/SuiteTest';
import LoadTestEdit from './LoadTestEdit';
import { FlowchartView } from '../flowchart';
import { FileContext } from '../fileContext';
import { usePanelPage } from '../usePanelPage';
import PanelRunHeader, { HeaderAction } from '../components/PanelRunHeader';
import PanelEditHeader from '../components/PanelEditHeader';

interface LoadTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

type LoadTestPage = 'test' | 'edit' | 'flow';
const NO_MISSING_FILES = new Set<string>();
const PAGE_WIDTH_PERCENTAGE = 100 / 3;

function pageTranslate(page: LoadTestPage): string {
  if (page === 'edit') {
    return `translateX(-${PAGE_WIDTH_PERCENTAGE}%)`;
  }
  if (page === 'flow') {
    return `translateX(-${PAGE_WIDTH_PERCENTAGE * 2}%)`;
  }
  return 'translateX(0%)';
}

const LoadTestPanel: React.FC<LoadTestPanelProps> = ({ content, setContent }) => {
  const [page, setPage] = usePanelPage<LoadTestPage>('test');
  const [flowchartState, setFlowchartState] = useState<SuiteFlowchartState | null>(null);
  const { mmtFilePath } = React.useContext(FileContext);

  useEffect(() => {
    setFlowchartState(null);
  }, [mmtFilePath]);

  useEffect(() => {
    if (page !== 'flow') {
      setFlowchartState(null);
    }
  }, [page]);
  const loadTestTitle = useMemo(() => {
    const parsed = parseYaml(content);
    return (parsed && typeof parsed.title === 'string') ? parsed.title : 'Load Test';
  }, [content]);

  return (
    <div className="panel">
      <div className="panel-box is-fill">
        <div className="api-swipe-root">
          <div
            className="api-swipe-track api-swipe-track--three"
            style={{ transform: pageTranslate(page) }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div className="panel-page is-clip">
                <PanelRunHeader
                  icon="dashboard"
                  title={loadTestTitle}
                  actions={
                    <>
                      <HeaderAction
                        icon="type-hierarchy-sub"
                        label="Flow chart"
                        onClick={() => setPage('flow')}
                        disabled={Boolean(flowchartState?.noItems)}
                      />
                        <HeaderAction
                          icon="edit"
                          label="Edit Load Test"
                          onClick={() => setPage('edit')}
                        />
                    </>
                  }
                />
                <SuiteTest
                  content={content}
                  mode="loadtest"
                  flowchartActive={page === 'flow'}
                  onFlowchartStateChange={setFlowchartState}
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              {page === 'edit' && (
                <React.Fragment key={mmtFilePath}>
                  <PanelEditHeader
                    title="Edit Load Test"
                    onBack={() => setPage('test')}
                    backTitle="Back to Load Test"
                  />

                  <LoadTestEdit content={content} setContent={setContent} />
                </React.Fragment>
              )}
            </div>

            <div className="api-swipe-page api-swipe-page--flow">
              {page === 'flow' && (
                <FlowchartView
                  key={mmtFilePath}
                  source={{
                    kind: 'suite',
                    rootTitle: loadTestTitle,
                    rootPath: mmtFilePath,
                    groups: flowchartState?.groups ?? [],
                    hierarchyByEntryId: flowchartState?.hierarchyByEntryId ?? {},
                    missingFiles: flowchartState?.missingFiles ?? NO_MISSING_FILES,
                  }}
                  onBack={() => setPage('test')}
                  title={loadTestTitle || 'Load Test'}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadTestPanel;
