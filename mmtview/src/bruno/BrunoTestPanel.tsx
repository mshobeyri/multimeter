import React from "react";
import { brunoToTest } from "mmt-core/brunoParsePack";
import { testToYaml } from "mmt-core/testParsePack";
import TestPanel from "../test/TestPanel";

interface BrunoTestPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const BrunoTestPanel: React.FC<BrunoTestPanelProps> = ({ content, setContent }) => (
  <TestPanel
    content={content}
    setContent={setContent}
    parseTest={brunoToTest}
    onSaveAsMmt={(test) => window.vscode?.postMessage({
      command: 'saveContentAsMmt',
      text: testToYaml(test),
    })}
  />
);

export default BrunoTestPanel;