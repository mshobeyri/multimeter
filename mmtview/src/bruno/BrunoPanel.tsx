import React, { useCallback, useContext, useMemo } from "react";
import type { BrunoSourceFile } from "mmt-core/brunoParsePack";
import { brunoCollectionToTest, brunoToTest, isBrunoCollectionFilePath } from "mmt-core/brunoParsePack";
import { listSpecApisFromFiles } from "mmt-core/importConvertor";
import { FileContext } from "../fileContext";
import SourceKindPanel from "../source/SourceKindPanel";

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
  // Opening bruno.json: use the loaded collection only (JSON is not a request).
  if (isBrunoCollectionFilePath(filePath || "")) {
    return files && files.length > 0 ? files : [];
  }
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
  const isCollection = isBrunoCollectionFilePath(mmtFilePath || "");
  const files = useMemo(
    () => mergeBrunoCollectionFiles(collectionFiles, mmtFilePath, content),
    [collectionFiles, mmtFilePath, content]
  );
  const apis = useMemo(() => listSpecApisFromFiles(files), [files]);
  const parseTest = useCallback((_value: string) => {
    if (isCollection) {
      return brunoCollectionToTest(files, collectionName || "Bruno collection");
    }
    return brunoToTest(content, mmtFilePath || "");
  }, [isCollection, files, collectionName, content, mmtFilePath]);

  return (
    <SourceKindPanel
      content={content}
      setContent={setContent}
      apis={apis}
      parseTest={parseTest}
      includeAll
      emptyMessage={isCollection
        ? "No Bruno requests were found in this collection."
        : "No Bruno request was found in this file."}
    />
  );
};

export default BrunoPanel;
