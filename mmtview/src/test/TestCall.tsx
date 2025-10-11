import React, { useEffect, useState } from "react";
import { TestFlowCallTest, TestFlowCallAPI } from "mmt-core/TestData";
import parseYaml, { packYaml } from "mmt-core/markupConvertor";
import { MMTFile, Parameter } from "mmt-core/CommonData";
import { showVSCodeMessage, readFile } from "../vsAPI";
import { safeList } from "mmt-core/safer";

interface TestCallProps {
  value: any; // can be alias string or { call, id?, inputs? }
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
  console.log("ss", value)
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
    <div>
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

      {/* Details of current call selection */}
      {(() => {
        const current = (value && typeof value === 'object') ? value : callInfo;
        if (!current || typeof current !== 'object') return null;
        const inputs = (current as any).inputs || {};
        const id = (current as any).id;
        const keys = Object.keys(inputs || {});
        return (
          <div style={{ marginTop: 8 }}>
            {id ? <div><strong>ID:</strong> {String(id)}</div> : null}
            <div style={{ marginTop: 4 }}><strong>Parameters:</strong></div>
            {keys.length ? (
              <ul style={{ margin: '4px 0 0 16px' }}>
                {Object.entries(inputs).map(([k, v]) => (
                  <li key={k}>
                    {k}: <code>{typeof v === 'string' ? v : JSON.stringify(v)}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ opacity: 0.7 }}>No parameters</div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default TestCall;