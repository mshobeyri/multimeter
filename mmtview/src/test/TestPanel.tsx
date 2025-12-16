import React, { useEffect, useRef, useState } from "react";
import { TestData } from "mmt-core/TestData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import TestCode from "./TestCode";
import { useImportValidation } from "../text/useImportValidation";

interface TestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_TAB_KEY = "mmtview:lastTab";

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

  const { missingImports, inputsByAlias } = useImportValidation(importsMap);

  // Restore last selected tab from localStorage, default to "overview"
  const [tab, setTab] = useState<"overview" | "flow" | "test">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "test") || "overview"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  // Save tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

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
      <div className="panel-box">
        <div
          ref={tabContainerRef}
          className="tab-bar"
        >
          <button
            onClick={() => setTab("overview")}
            className={`tab-button ${tab === "overview" ? "active" : ""}`}
            title={showIconsOnly ? "Overview" : undefined}
          >
            <span className="codicon codicon-search tab-button-icon"></span>
            {!showIconsOnly && "Overview"}
          </button>
          <button
            onClick={() => setTab("flow")}
            className={`tab-button ${tab === "flow" ? "active" : ""}`}
            title={showIconsOnly ? "Flow" : undefined}
          >
            <span className="codicon codicon-list-tree tab-button-icon"></span>
            {!showIconsOnly && "Flow"}
          </button>
          <button
            onClick={() => setTab("test")}
            className={`tab-button ${tab === "test" ? "active" : ""}`}
            title={showIconsOnly ? "Test" : undefined}
          >
            <span className="codicon codicon-play tab-button-icon"></span>
            {!showIconsOnly && "Test"}
          </button>
        </div>

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
            importValidation={{ missingImports, inputsByAlias }}
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
        {tab === "test" && (
          <TestCode
            testData={test}
          />
        )}
      </div>
    </div>
  );
};

export default TestPanel;