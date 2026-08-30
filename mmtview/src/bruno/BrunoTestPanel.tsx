import React from "react";
import { brunoToTest } from "mmt-core/brunoParsePack";
import { testToYaml } from "mmt-core/testParsePack";
import TestPanel from "../test/TestPanel";

interface BrunoTestPanelProps {
  content: string;
  setContent: (value: string) => void;
  headerLeading?: React.ReactNode;
}

const BrunoTestPanel: React.FC<BrunoTestPanelProps> = ({ content, setContent, headerLeading }) => (
  <TestPanel
    content={content}
    setContent={setContent}
    parseTest={brunoToTest}
    headerLeading={headerLeading}
    onSaveAsMmt={(test) => window.vscode?.postMessage({
      command: 'saveContentAsMmt',
      text: testToYaml(test),
    })}
  />
);

export default BrunoTestPanel;