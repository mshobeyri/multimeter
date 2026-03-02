import React, { useEffect, useRef, useState } from "react";
import { TestData } from "mmt-core/TestData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import TestCode from "./TestCode";
import { useImportValidation } from "../text/useImportValidation";
import TestTest from "./TestTest";

interface TestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_TAB_KEY = "mmtview:lastTab";
const LAST_TEST_PAGE_KEY = "mmtview:test:lastPage";

const TestPanel: React.FC<TestPanelProps> = ({ content, setContent }) => {
  const test = React.useMemo(() => yamlToTest(content), [content]);
  const testRef = React.useRef<TestData>(test);
  const contentRef = React.useRef(content);

  useEffect(() => {
    testRef.current = test;
  }, [test]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const setTest = React.useCallback((next: TestData | ((prev: TestData) => TestData)) => {
    const resolved = typeof next === "function" ? (next as (prev: TestData) => TestData)(testRef.current) : next;
    testRef.current = resolved;
    const newYaml = testToYaml(resolved);
    if (newYaml === contentRef.current) {
      return;
    }
    contentRef.current = newYaml;
    setContent(newYaml);
  }, [setContent]);

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

  // Restore last selected tab from localStorage, default to "overview"
  const [page, setPage] = useState<"test" | "edit">(
    () => (localStorage.getItem(LAST_TEST_PAGE_KEY) as "test" | "edit") || "test"
  );
  const [tab, setTab] = useState<"overview" | "flow" | "code">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "code") || "overview"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  // Save tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    localStorage.setItem(LAST_TEST_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) return;

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      const fullTextWidth = 4 * 100;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "auto" }}>
                <TestTest
                  testData={test}
                  rightOfRunButton={(
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Test"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Test</span>
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
                  <div className="api-edit-title">Edit Test</div>
                </div>

                <div className="tab-bar">
                  <button
                    onClick={() => setTab("overview")}
                    className={`tab-button ${tab === "overview" ? "active" : ""}`}
                    title={showIconsOnly ? "Overview" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-search tab-button-icon"></span>
                    {!showIconsOnly && "Overview"}
                  </button>
                  <button
                    onClick={() => setTab("flow")}
                    className={`tab-button ${tab === "flow" ? "active" : ""}`}
                    title={showIconsOnly ? "Flow" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-list-tree tab-button-icon"></span>
                    {!showIconsOnly && "Flow"}
                  </button>
                  <button
                    onClick={() => setTab("code")}
                    className={`tab-button ${tab === "code" ? "active" : ""}`}
                    title={showIconsOnly ? "Code" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-code tab-button-icon"></span>
                    {!showIconsOnly && "Code"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {tab === "overview" && (
                  <TestOverview
                    test={test}
                    update={(patch) => setTest(prev => ({ ...prev, ...patch }))}
                    missingImports={missingImports}
                />
              )}
              {tab === "flow" && (
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
                {tab === "code" && <TestCode testData={test} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPanel;