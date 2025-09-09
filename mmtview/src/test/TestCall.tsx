import React, { useEffect, useState } from "react";
import { TestFlowCallTest, TestFlowCallAPI } from "mmt-core/dist/TestData";
import parseYaml, { packYaml } from "mmt-core/dist/markupConvertor";
import { MMTFile, Parameter } from "mmt-core/dist/CommonData";
import { showVSCodeMessage, readFile } from "../vsAPI";
import { safeList } from "mmt-core/dist/safer";

interface TestCallProps {
  value: string;
  imports?: Record<string, string>;
  onChange: (value: any) => void;
  placeholder?: string;
}

interface SelectedAlias {
  alias: string;
  fileName: string;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
}) => {
  const [callInfo, setCallInfo] = useState<TestFlowCallTest | TestFlowCallAPI | null>(null);
  const [selectedAlias, setSelectedAlias] = useState<SelectedAlias | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    // Find the fileName for the selected alias
    let fileName = "";
    if (imports && selected in imports) {
      fileName = imports[selected];
    }
    setSelectedAlias({ alias: selected, fileName });
  };

  useEffect(() => {
    if (!selectedAlias) return

    const { alias, fileName } = selectedAlias;

    readFile(fileName)
      .then((content: string) => {
        const yaml = parseYaml(content);

        if (!yaml || typeof yaml !== "object") {
          showVSCodeMessage("error", "Cannot parse " + fileName + "!");
          return;
        }
        if (!yaml.type) {
          showVSCodeMessage("error", fileName + " has no type!");
          return;
        }
        if (yaml.type !== "test" && yaml.type !== "api") {
          showVSCodeMessage("error", fileName + " type should be test or api!");
          return;
        }
        setCallInfo({ call: alias, inputs: yaml.inputs } as TestFlowCallTest);
      })
      .catch(() => {
        showVSCodeMessage("error", "Failed to read file: \n" + fileName);
        setCallInfo(null);
      });
  }, [selectedAlias]);

  useEffect(() => {
    if (callInfo) {
      onChange(callInfo);
    }
  }, [callInfo]);

  // Use the current target as the select value
  const currentTarget = (callInfo && (callInfo as any).target) || "";

  return (
    <select
      value={currentTarget}
      onChange={handleChange}
      style={{ width: "100%" }}
    >
      <option value="">{placeholder}</option>
      {imports &&
        safeList(imports).map((imp: Parameter) => {
          const alias = Object.keys(imp)[0];
          return (
            <option key={alias} value={alias}>
              {alias}
            </option>
          );
        })}
      <option disabled>──────────</option>
      <option value="http">http</option>
      <option value="ws">ws</option>
    </select>
  );
};

export default TestCall;