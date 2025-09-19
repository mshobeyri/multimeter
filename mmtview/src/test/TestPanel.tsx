import React, { useEffect, useRef, useState } from "react";
import { TestData } from "mmt-core/TestData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";
import { yamlToTest, testToYaml } from "mmt-core/testParsePack";
import TestCode from "./TestCode";

interface TestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_TAB_KEY = "mmtview:lastTab";

const TestPanel: React.FC<TestPanelProps> = ({ content, setContent }) => {
  const [test, setTest] = useState<TestData>(yamlToTest(content));

  // Parse YAML to test when content changes (but not if we just updated content from UI)
  useEffect(() => {
    const newTest = yamlToTest(content);
    if (newTest === test || newTest === {} as TestData) return;
    setTest(newTest);
  }, [content]);

  // Update YAML when test changes (but not if we just updated test from YAML)
  useEffect(() => {
    const newYaml = testToYaml(test);
    if (newYaml === content || newYaml === "") {
      return;
    }
    setContent(newYaml);
  }, [test]);

  // Restore last selected tab from localStorage, default to "overview"
  const [tab, setTab] = useState<"overview" | "flow" | "examples" | "test">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "examples" | "test") || "overview"
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
            onClick={() => setTab("examples")}
            className={`tab-button ${tab === "examples" ? "active" : ""}`}
            title={showIconsOnly ? "Examples" : undefined}
          >
            <span className="codicon codicon-lightbulb tab-button-icon"></span>
            {!showIconsOnly && "Examples"}
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
          />
        )}
        {tab === "flow" && (
          <TestFlow
            testData={test}
            update={(newFlow) => {
              console.log("Updating flow:", newFlow);
            }}
          />
        )}
        {tab === "examples" && (
          <div>
            <h2>Examples</h2>
            {/* <pre>{JSON.stringify(test.examples, null, 2)}</pre> */}
          </div>
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