import React, { useMemo, useState } from 'react';
import 'react-complex-tree/lib/style.css';
import SuiteEdit from './edit/SuiteEdit';
import SuiteTest, { SuiteFlowchartState } from './test/SuiteTest';
import { parseYaml } from 'mmt-core/markupConvertor';
import { FlowchartView } from '../flowchart';
import { FileContext } from '../fileContext';
import PanelRunHeader, { HeaderAction } from '../components/PanelRunHeader';
import PanelEditHeader from '../components/PanelEditHeader';

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
                <PanelRunHeader
                  icon="layers"
                  title={suiteTitle}
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
                        label="Edit Suite"
                        onClick={() => setPage('edit')}
                      />
                    </>
                  }
                />
                <SuiteTest
                  content={content}
                  onFlowchartStateChange={setFlowchartState}
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit Suite"
                onBack={() => setPage('test')}
                backTitle="Back to Test"
              />

              <SuiteEdit content={content} setContent={setContent} />
            </div>

            <div className="api-swipe-page api-swipe-page--flow">
              <FlowchartView
                source={{
                  kind: 'suite',
                  rootTitle: suiteTitle,
                  rootPath: mmtFilePath,
                  groups: flowchartState?.groups ?? [],
                  hierarchyByEntryId: flowchartState?.hierarchyByEntryId ?? {},
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
