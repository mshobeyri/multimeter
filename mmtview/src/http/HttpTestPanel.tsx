import React from "react";
import { httpToTest } from "mmt-core/httpParsePack";
import { testToYaml } from "mmt-core/testParsePack";
import TestPanel from "../test/TestPanel";

interface HttpTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const HttpTestPanel: React.FC<HttpTestPanelProps> = ({ content, setContent }) => (
  <TestPanel
    content={content}
    setContent={setContent}
    parseTest={httpToTest}
    onSaveAsMmt={(test) => window.vscode?.postMessage({
      command: 'saveContentAsMmt',
      text: testToYaml(test),
    })}
  />
);

export default HttpTestPanel;
