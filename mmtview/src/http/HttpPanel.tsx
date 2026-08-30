import React, { useCallback, useContext, useMemo } from "react";
import { httpToTest } from "mmt-core/httpParsePack";
import { listSpecApis } from "mmt-core/importConvertor";
import { FileContext } from "../fileContext";
import SourceKindPanel from "../source/SourceKindPanel";

interface HttpPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const HttpPanel: React.FC<HttpPanelProps> = ({ content, setContent }) => {
  const { mmtFilePath } = useContext(FileContext);
  const apis = useMemo(() => listSpecApis(content, mmtFilePath || ""), [content, mmtFilePath]);
  const parseTest = useCallback((value: string) => {
    return httpToTest(value, mmtFilePath || "");
  }, [mmtFilePath]);

  return (
    <SourceKindPanel
      content={content}
      setContent={setContent}
      apis={apis}
      parseTest={parseTest}
      includeAll
      emptyMessage="No HTTP requests were found in this file."
    />
  );
};

export default HttpPanel;
