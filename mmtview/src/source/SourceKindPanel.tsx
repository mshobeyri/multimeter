import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiToYaml } from "mmt-core/apiParsePack";
import { findSpecApiSelection, SpecApiItem } from "mmt-core/importConvertor";
import { TestData } from "mmt-core/TestData";
import { testToYaml } from "mmt-core/testParsePack";
import APIPanel from "../api/APIPanel";
import ApiSelector, { ApiSelectorItem } from "../spec/ApiSelector";
import TestPanel from "../test/TestPanel";

export const SOURCE_ALL_ID = "all";

export const SOURCE_ALL_ITEM: ApiSelectorItem = {
  id: SOURCE_ALL_ID,
  title: "All",
  method: "TEST",
  examples: [],
};

interface SourceKindPanelProps {
  content: string;
  setContent: (value: string) => void;
  apis: SpecApiItem[];
  parseTest?: (value: string) => TestData;
  includeAll?: boolean;
  emptyMessage: string;
}

function saveAsMmt(text: string) {
  window.vscode?.postMessage({
    command: "saveContentAsMmt",
    text,
  });
}

const SourceKindPanel: React.FC<SourceKindPanelProps> = ({
  content,
  setContent,
  apis,
  parseTest,
  includeAll = false,
  emptyMessage,
}) => {
  const items = useMemo(
    () => includeAll && parseTest ? [SOURCE_ALL_ITEM, ...apis] : apis,
    [apis, includeAll, parseTest]
  );
  const defaultId = includeAll && parseTest ? SOURCE_ALL_ID : items[0]?.id;
  const [selectedId, setSelectedId] = useState(defaultId);

  useEffect(() => {
    const known = items.some(item =>
      item.id === selectedId || (item.examples || []).some(example => example.id === selectedId));
    if (known) {
      return;
    }
    setSelectedId(defaultId);
  }, [items, selectedId, defaultId]);

  const isAll = includeAll && parseTest && selectedId === SOURCE_ALL_ID;
  const selection = findSpecApiSelection(apis, selectedId);
  const selected = selection?.item;

  const onSaveItem = useCallback((id: string) => {
    if (id === SOURCE_ALL_ID && parseTest) {
      saveAsMmt(testToYaml(parseTest(content)));
      return;
    }
    const picked = findSpecApiSelection(apis, id);
    if (picked?.item) {
      saveAsMmt(apiToYaml(picked.item.api));
    }
  }, [apis, parseTest, content]);

  const sourceSelector = items.length > 0 ? (
    <ApiSelector
      items={items}
      value={selectedId}
      onChange={setSelectedId}
      variant={isAll ? "header" : "method"}
      onSaveItem={onSaveItem}
    />
  ) : null;

  if (apis.length === 0) {
    return (
      <div className="panel">
        <div className="panel-box" style={{ padding: 16 }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  if (isAll && parseTest) {
    return (
      <TestPanel
        content={content}
        setContent={setContent}
        parseTest={parseTest}
        headerLeading={sourceSelector}
        readOnly
      />
    );
  }

  if (!selected) {
    return (
      <div className="panel">
        <div className="panel-box" style={{ padding: 16 }}>
          {emptyMessage}
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
      selector={sourceSelector}
    />
  );
};

export default SourceKindPanel;
