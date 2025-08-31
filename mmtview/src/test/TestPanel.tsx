import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import { TestData } from "./TestData";
import TestOverview from "./TestOverview";
import TestFlow from "./TestFlow";

interface TestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

function yamlToTest(yamlContent: string): TestData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object") return {} as TestData;
    return {
      type: doc.type || "",
      title: doc.title || "",
      tags: doc.tags || [],
      description: doc.description || "",
      import: doc.import,
      metrics: doc.metrics,
      inputs: doc.inputs,
      outputs: doc.outputs,
      flow: doc.flow,
    };
  } catch {
    return {} as TestData;
  }
}

function testToYaml(test: TestData): string {
  const yamlObj: Record<string, any> = {
    type: test.type,
    title: test.title,
    tags: test.tags,
  };
  if (test.description) yamlObj.description = test.description;
  if (test.import) yamlObj.import = test.import;
  if (test.inputs) yamlObj.inputs = test.inputs;
  if (test.outputs) yamlObj.outputs = test.outputs;
  if (test.metrics) yamlObj.metrics = test.metrics;
  if (test.flow) yamlObj.flow = test.flow;
  return packYaml(yamlObj);
}

const LAST_TAB_KEY = "mmtview:lastTab";

const TestPanel: React.FC<TestPanelProps> = ({ content, setContent }) => {
  const [test, setTest] = useState<TestData>({
    type: "test",
    title: "",
    tags: [],
    description: "",
    import: {},
    metrics: {},
    inputs: {},
    outputs: {},
    flow: [],
  });
  const lastUpdate = useRef<"yaml" | "ui" | null>(null);
  // Restore last selected tab from localStorage, default to "overview"
  const [tab, setTab] = useState<"overview" | "flow" | "examples">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "examples") || "overview"
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

      // Calculate approximate width needed for full text tabs
      // Rough estimate: 120px per tab for text + icon
      const fullTextWidth = 3 * 120;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Parse YAML to test when content changes (but not if we just updated content from UI)
  useEffect(() => {
    if (lastUpdate.current === "ui") {
      lastUpdate.current = null;
      return;
    }
    setTest(yamlToTest(content));
    lastUpdate.current = "yaml";
  }, [content]);

  // Update YAML when test changes (but not if we just updated test from YAML)
  useEffect(() => {
    if (lastUpdate.current === "yaml") {
      lastUpdate.current = null;
      return;
    }
    setContent(testToYaml(test));
    lastUpdate.current = "ui";
  }, [test, setContent]);

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
        </div>
        {/* Tab Content */}
        {tab === "overview" && (
          <div>
            <TestOverview
              test={test}
              update={(patch) => setTest(prev => ({ ...prev, ...patch }))}
            />
          </div>
        )}
        {tab === "flow" && (
          <div>
            <TestFlow
              testData={test}
              update={newTest => setTest(prev => ({ ...prev, flow: newTest.flow }))}
            />
          </div>
        )}
        {tab === "examples" && (
          <div>
            <h2>Examples</h2>
            {/* <pre>{JSON.stringify(test.examples, null, 2)}</pre> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPanel;