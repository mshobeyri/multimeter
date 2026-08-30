import React, { useEffect, useMemo, useState } from "react";
import { apiToYaml } from "mmt-core/apiParsePack";
import { findSpecApiSelection, listSpecApis } from "mmt-core/importConvertor";
import APIPanel from "../api/APIPanel";
import { HeaderAction } from "../components/PanelRunHeader";
import { FileContext } from "../fileContext";
import ApiSelector from "./ApiSelector";

interface SpecApiPanelProps {
  content: string;
}

const SpecApiPanel: React.FC<SpecApiPanelProps> = ({ content }) => {
  const { mmtFilePath } = React.useContext(FileContext);
  const items = useMemo(() => listSpecApis(content, mmtFilePath || ""), [content, mmtFilePath]);
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
          No API operations were found in this spec.
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
          <ApiSelector items={items} value={selectedId || selected.id} onChange={setSelectedId} />
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
