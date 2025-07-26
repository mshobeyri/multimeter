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
    import: [],
    metrics: {},
    inputs: [],
    outputs: [],
    flow: [],
  });
  const lastUpdate = useRef<"yaml" | "ui" | null>(null);
  // Restore last selected tab from localStorage, default to "overview"
  const [tab, setTab] = useState<"overview" | "flow" | "examples">(
    () => (localStorage.getItem(LAST_TAB_KEY) as "overview" | "flow" | "examples") || "overview"
  );

  // Save tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        minWidth: 100,
        maxWidth: "80vw",
        overflow: "auto",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "var(--vscode-editorWidget-background, #232323)",
          border: "1px solid var(--vscode-editorWidget-border, #333)",
          borderRadius: "6px",
          padding: "16px",
          minWidth: 200,
          marginBottom: "16px"
        }}
      >
        {/* Tab Bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}>
          <button
            onClick={() => setTab("overview")}
            style={{
              padding: "8px 24px",
              border: "none",
              borderBottom: tab === "overview" ? "2px solid #0e639c" : "2px solid transparent",
              background: "none",
              color: "inherit",
              fontWeight: tab === "overview" ? "bold" : "normal",
              cursor: "pointer"
            }}
          >
            <span role="img" aria-label="overview">🔎</span> Overview
          </button>
          <button
            onClick={() => setTab("flow")}
            style={{
              padding: "8px 24px",
              border: "none",
              borderBottom: tab === "flow" ? "2px solid #0e639c" : "2px solid transparent",
              background: "none",
              color: "inherit",
              fontWeight: tab === "flow" ? "bold" : "normal",
              cursor: "pointer"
            }}
          >
            <span role="img" aria-label="flow">🛝</span> Flow
          </button>
          <button
            onClick={() => setTab("examples")}
            style={{
              padding: "8px 24px",
              border: "none",
              borderBottom: tab === "examples" ? "2px solid #0e639c" : "2px solid transparent",
              background: "none",
              color: "inherit",
              fontWeight: tab === "examples" ? "bold" : "normal",
              cursor: "pointer"
            }}
          >
            <span role="img" aria-label="examples">💡</span> Examples
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