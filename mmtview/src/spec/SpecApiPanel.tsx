import React, { useMemo } from "react";
import type { BrunoSourceFile } from "mmt-core/parse/brunoParsePack";
import { listSpecApis, listSpecApisFromFiles } from "mmt-core/convert/importConvertor";
import { FileContext } from "../fileContext";
import SourceKindPanel from "../source/SourceKindPanel";

interface SpecApiPanelProps {
  content: string;
  files?: BrunoSourceFile[];
}

const SpecApiPanel: React.FC<SpecApiPanelProps> = ({ content, files }) => {
  const { mmtFilePath } = React.useContext(FileContext);
  const apis = useMemo(() => {
    if (files && files.length > 0) {
      return listSpecApisFromFiles(files);
    }
    return listSpecApis(content, mmtFilePath || "");
  }, [content, files, mmtFilePath]);

  return (
    <SourceKindPanel
      content={content}
      setContent={() => undefined}
      apis={apis}
      emptyMessage="No API operations were found in this spec."
    />
  );
};

export default SpecApiPanel;
