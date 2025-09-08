import React from "react";
import TextEditor from "../text/TextEditor";
import { testToJsfunc } from "mmt-core/dist/JSer";

interface TestCodeProps {
  testData: any;
}

const TestCode: React.FC<TestCodeProps> = ({ testData }) => {
  // Convert test steps to JS code
  const jsCode = React.useMemo(() => testToJsfunc({
    name: testData?.title || "TestFlow",
    test: testData,
    inputs: testData?.inputs || {},
    envVars: testData?.envVars || {},
  }), [testData]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <TextEditor
        content={jsCode}
        setContent={() => {}}
        language="javascript"
      />
    </div>
  );
};

export default TestCode;