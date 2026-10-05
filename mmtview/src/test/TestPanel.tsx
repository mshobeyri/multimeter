import React, { useEffect, useRef, useState, useMemo } from "react";
import { TestData } from "mmt-core/TestData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import TestCode from "./TestCode";
import { useImportValidation } from "../text/useImportValidation";
import TestTest from "./TestTest";
import { FileContext } from "../fileContext";
import { usePanelPage } from "../usePanelPage";
import { FlowchartView } from "../flowchart";
import TabBar from "../components/TabBar";
import PanelRunHeader, { HeaderAction } from "../components/PanelRunHeader";
import PanelEditHeader from "../components/PanelEditHeader";

interface TestPanelProps {
  content: string;
  setContent: (value: string, options?: { force?: boolean }) => void;
  parseTest?: (value: string) => TestData;
  onSaveAsMmt?: (test: TestData) => void;
  readOnly?: boolean;
  headerLeading?: React.ReactNode;
}

type TestPage = "test" | "edit" | "flow";

const TEST_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "flow" as const, label: "Flow", icon: "list-tree" },
  { id: "code" as const, label: "Code", icon: "code" },
];

function pageTranslate(page: TestPage): string {
  if (page === "edit") {
    return "translateX(-33.333333%)";
  }
  if (page === "flow") {
    return "translateX(-66.666667%)";
  }
  return "translateX(0%)";
}

const TestPanel: React.FC<TestPanelProps> = ({ content, setContent, parseTest = yamlToTest, onSaveAsMmt, readOnly, headerLeading }) => {
  // `appliedContent` is what the right-side test UI is built from.
  // Runtime input edits stay ephemeral and do not mark the test YAML as modified.
  const [appliedContent, setAppliedContent] = useState(content);

  const test = useMemo(() => parseTest(appliedContent), [appliedContent, parseTest]);
  const testRef = React.useRef<TestData>(test);
  const contentRef = React.useRef(content);
  const isReadOnly = readOnly || !!onSaveAsMmt;


  useEffect(() => {
    testRef.current = test;
  }, [test]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const setTest = React.useCallback((next: TestData | ((prev: TestData) => TestData)) => {
    const resolved = typeof next === "function" ? (next as (prev: TestData) => TestData)(testRef.current) : next;
    testRef.current = resolved;
    const newYaml = testToYaml(resolved, contentRef.current);
    if (newYaml === contentRef.current && newYaml === appliedContent) {
      return;
    }
    contentRef.current = newYaml;
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
  }, [setContent, appliedContent]);

  const [page, setPage] = usePanelPage<TestPage>("test");
  const [tab, setTab] = useState<"overview" | "flow" | "code">("overview");
  const { mmtFilePath } = React.useContext(FileContext);

  useEffect(() => {
    setTab("overview");
  }, [mmtFilePath]);

  useEffect(() => {
    if (content !== appliedContent) {
      setAppliedContent(content);
    }
  }, [content, appliedContent]);

  const importsMap = React.useMemo(() => {
    const raw = test?.import;
    if (!raw || typeof raw !== "object") {
      return {} as Record<string, string>;
    }
    const sanitized: Record<string, string> = {};
    for (const [alias, value] of Object.entries(raw)) {
      if (typeof alias === "string" && typeof value === "string" && alias.trim() && value.trim()) {
        sanitized[alias] = value;
      }
    }
    return sanitized;
  }, [test]);

  const { missingImports, inputsByAlias, outputsByAlias } = useImportValidation(importsMap);

  useEffect(() => {
    if (isReadOnly && page === 'edit') {
      setPage('test');
    }
  }, [page, isReadOnly]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && typeof msg === 'object' && msg.command === 'switchToCodeTab') {
        if (isReadOnly) {
          return;
        }
        setPage('edit');
        setTab('code');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isReadOnly]);

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
                  icon="beaker"
                  title={test.title || 'Test'}
                  beforeTitle={headerLeading}
                  actions={
                    <>
                      <HeaderAction
                        icon="type-hierarchy-sub"
                        label="Flow chart"
                        onClick={() => setPage('flow')}
                      />
                        {onSaveAsMmt ? (
                          <HeaderAction
                            icon="save-as"
                            label="Save as MMT"
                            iconOnly
                            onClick={() => onSaveAsMmt(test)}
                          />
                        ) : !isReadOnly ? (
                          <HeaderAction
                            icon="edit"
                            label="Edit Test"
                            onClick={() => setPage('edit')}
                          />
                        ) : null}
                    </>
                  }
                />
                <div className="panel-page">
                  <TestTest
                    testData={test}
                    runYaml={appliedContent}
                  />
                </div>
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              {page === 'edit' && (
                <React.Fragment key={mmtFilePath}>
                  <PanelEditHeader
                    title="Edit Test"
                    onBack={() => setPage('test')}
                    backTitle="Back to Test"
                  >
                    <TabBar tabs={TEST_EDIT_TABS} value={tab} onChange={setTab} />
                  </PanelEditHeader>

                  <div className="panel-scroll">
                    {!isReadOnly && tab === "overview" && (
                      <TestOverview
                        test={test}
                        update={(patch) => setTest(prev => ({ ...prev, ...patch }))}
                        missingImports={missingImports}
                      />
                    )}
                    {!isReadOnly && tab === "flow" && (
                      <TestFlow
                        testData={test}
                        importValidation={{ missingImports, inputsByAlias, outputsByAlias }}
                        update={(patch) => {
                          setTest(prev => {
                            const next = { ...prev } as any;
                            if (patch.stages) {
                              next.stages = patch.stages;
                              delete next.steps;
                            } else if (patch.steps) {
                              next.steps = patch.steps;
                              delete next.stages;
                            }
                            return next;
                          });
                        }}
                      />
                    )}
                    {!isReadOnly && tab === "code" && <TestCode testData={test} />}
                  </div>
                </React.Fragment>
              )}
            </div>

            <div className="api-swipe-page api-swipe-page--flow">
              {page === 'flow' && (
                <FlowchartView
                  key={mmtFilePath}
                  source={{ kind: 'test', test, filePath: mmtFilePath }}
                  onBack={() => setPage('test')}
                  title={test.title || 'Test'}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPanel;
