import React, { useCallback, useContext, useMemo, useState } from "react";
import type { BrunoSourceFile } from "mmt-core/brunoParsePack";
import { brunoCollectionToTest, brunoToTest } from "mmt-core/brunoParsePack";
import { testToYaml } from "mmt-core/testParsePack";
import SourceViewSwitch, { SourceViewMode } from "../components/SourceViewSwitch";
import { FileContext } from "../fileContext";
import SpecApiPanel from "../spec/SpecApiPanel";
import TestPanel from "../test/TestPanel";

const BRUNO_VIEW_KEY = "mmtview:bruno:view";

function readBrunoView(): SourceViewMode {
  return localStorage.getItem(BRUNO_VIEW_KEY) === "test" ? "test" : "api";
}

function sameBrunoFile(file: BrunoSourceFile, filePath?: string): boolean {
  if (!filePath) {
    return false;
  }
  if (file.uri && file.uri === filePath) {
    return true;
  }
  const left = file.path.replace(/\\/g, "/").toLowerCase();
  const right = decodeURIComponent(filePath.replace(/^file:\/\//, "")).replace(/\\/g, "/").toLowerCase();
  return left === right || right.endsWith(left) || left.endsWith(right);
}

export function mergeBrunoCollectionFiles(
    files: BrunoSourceFile[] | undefined,
    filePath: string | undefined,
    content: string): BrunoSourceFile[] {
  if (!files || files.length === 0) {
    if (!content.trim()) {
      return [];
    }
    return [{path: filePath || "request.bru", content, uri: filePath}];
  }
  let matched = false;
  const next = files.map(file => {
    if (sameBrunoFile(file, filePath)) {
      matched = true;
      return {...file, content};
    }
    return file;
  });
  if (!matched && content.trim()) {
    next.push({path: filePath || "request.bru", content, uri: filePath});
  }
  return next;
}

interface BrunoPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const BrunoPanel: React.FC<BrunoPanelProps> = ({ content, setContent }) => {
  const { mmtFilePath, collectionFiles, collectionName } = useContext(FileContext);
  const [view, setView] = useState<SourceViewMode>(readBrunoView);
  const files = useMemo(
    () => mergeBrunoCollectionFiles(collectionFiles, mmtFilePath, content),
    [collectionFiles, mmtFilePath, content]
  );
  const onChangeView = useCallback((next: SourceViewMode) => {
    localStorage.setItem(BRUNO_VIEW_KEY, next);
    setView(next);
  }, []);
  const parseTest = useCallback((_value: string) => {
    if (files.length > 1) {
      return brunoCollectionToTest(files, collectionName || "Bruno collection");
    }
    return brunoToTest(content, mmtFilePath || "");
  }, [files, collectionName, content, mmtFilePath]);
  const switcher = <SourceViewSwitch value={view} onChange={onChangeView} />;

  if (view === "test") {
    return (
      <TestPanel
        content={content}
        setContent={setContent}
        parseTest={parseTest}
        headerLeading={switcher}
        onSaveAsMmt={(test) => window.vscode?.postMessage({
          command: "saveContentAsMmt",
          text: testToYaml(test),
        })}
      />
    );
  }
  return <SpecApiPanel content={content} files={files} leading={switcher} />;
};

export default BrunoPanel;
