import React, { useEffect, useState } from "react";
import { TestFlowCallTest, TestFlowCallAPI, TestFlowCallDirect } from "./TestData";
import parseYaml, { packYaml } from "../markupConvertor";
import { MMTFile, Parameter } from "../CommonData";
import { showVSCodeMessage, readFile } from "../vsAPI";

interface TestCallProps {
  value: string;
  imports?: Parameter[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const TestCall: React.FC<TestCallProps> = ({
  value,
  imports,
  onChange,
  placeholder = "Select an item...",
}) => {
  const [callInfo, setCallInfo] = useState<TestFlowCallTest | TestFlowCallAPI | TestFlowCallDirect | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    setFileName(selectedValue);
  };
  useEffect(() => {
    readFile(fileName)
      .then((content: string) => {
        console.log("File content:", content);
        const yaml = parseYaml(content);

        if (!yaml || typeof yaml !== "object") {
          showVSCodeMessage("error", "Cannot parse " + fileName + "!");
          return;
        }
        if (!yaml.type) {
          showVSCodeMessage("error", fileName + "has no type!");
          return;
        }
        if (yaml.type !== "test" && yaml.type !== "api") {
          showVSCodeMessage("error", fileName + "type should be test or api!");
          return;
        }
        if (yaml.type === "test") {
          setCallInfo({ test: fileName } as TestFlowCallTest);
        } else if (yaml.type === "api") {
          setCallInfo({ api: fileName } as TestFlowCallAPI);
        } else {
          setCallInfo(null);
        }
      })
      .catch((err: unknown) => {
        showVSCodeMessage("error", "Failed to read file: " + fileName);
        setCallInfo(null);
      });
  }, [fileName]);

  useEffect(() => {
    if (callInfo) {
      const yamlStr = packYaml(callInfo);
      console.log("YAML String:", callInfo, yamlStr);
    }
  }, [callInfo]);

  return (
    <select
      value={value}
      onChange={handleChange}
      style={{ width: "100%", padding: "6px" }}
    >
      <option value="">{placeholder}</option>
      {imports &&
        imports.map((imp: Parameter, idx) => {
          const key = Object.keys(imp)[0];
          const val = Object.values(imp)[0];
          return (
            <option key={key} value={val}>
              {key}
            </option>
          );
        })}
    </select>
  );
};

export default TestCall;