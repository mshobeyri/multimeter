import React, { useEffect, useMemo, useState } from "react";
import { apiToYaml } from "mmt-core/apiParsePack";
import type { BrunoSourceFile } from "mmt-core/brunoParsePack";
import { findSpecApiSelection, listSpecApis, listSpecApisFromFiles } from "mmt-core/importConvertor";
import APIPanel from "../api/APIPanel";
import { HeaderAction } from "../components/PanelRunHeader";
import { FileContext } from "../fileContext";
import ApiSelector from "./ApiSelector";

interface SpecApiPanelProps {
  content: string;
  files?: BrunoSourceFile[];
  leading?: React.ReactNode;
}

const SpecApiPanel: React.FC<SpecApiPanelProps> = ({ content, files, leading }) => {
  const { mmtFilePath } = React.useContext(FileContext);
  const items = useMemo(() => {
    if (files && files.length > 0) {
      return listSpecApisFromFiles(files);
    }
    return listSpecApis(content, mmtFilePath || "");
  }, [content, files, mmtFilePath]);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const selection = findSpecApiSelection(items, selectedId);
  const selected = selection?.item;

  useEffect(() => {
    const known = items.some(item =>
      item.id === selectedId || item.examples.some(example => example.id === selectedId));
    if (known) {
      return;
    }
    setSelectedId(items[0]?.id);
  }, [items, selectedId]);

  if (!selected) {
    return (
      <div className="panel">
        <div className="panel-box" style={{ padding: 16 }}>
          {leading}
          <div style={{ paddingTop: leading ? 12 : 0 }}>
            No API operations were found in this spec.
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIPanel
      key={`${selected.id}:${selection.exampleIndex}`}
      content={apiToYaml(selected.api)}
      setContent={() => undefined}
      readOnly
      initialExampleIndex={selection.exampleIndex}
      selector={
        <>
          {leading}
          {items.length > 1 || selected.examples.length > 0 ? (
            <ApiSelector items={items} value={selectedId || selected.id} onChange={setSelectedId} />
          ) : null}
          <HeaderAction
            icon="save-as"
            label="Save as MMT"
            onClick={() => window.vscode?.postMessage({
              command: "saveContentAsMmt",
              text: apiToYaml(selected.api),
            })}
          />
        </>
      }
    />
  );
};

export default SpecApiPanel;
