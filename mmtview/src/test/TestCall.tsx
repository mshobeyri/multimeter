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
  const [local, setLocal] = useState<any>(typeof value === 'object' && value ? value : null);
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

  // Keep local state in sync with external value updates
  useEffect(() => {
    if (value && typeof value === 'object') {
      setLocal(value);
    }
  }, [value]);

  useEffect(() => {
    if (callInfo) {
      setLocal(callInfo);
      onChange(callInfo);
    }
  }, [callInfo]);

  // Use the current call as the select value
  const currentTarget = (local && (local as any).call) || "";

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

      {/* Editable details of current call selection */}
      {(() => {
        const current = local;
        if (!current || typeof current !== 'object') return null;
        const inputs = (current as any).inputs || {};
        const keys = Object.keys(inputs || {});

        const onIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const next = { ...current, id: e.target.value };
          setLocal(next);
          onChange(next);
        };

        const onInputChange = (key: string, val: string) => {
          const nextInputs = { ...inputs, [key]: val };
          const next = { ...current, inputs: nextInputs };
          setLocal(next);
          onChange(next);
        };

        return (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>ID</label>
              <input
                type="text"
                value={(current as any).id || ''}
                onChange={onIdChange}
                style={{ width: '100%', padding: '6px 8px' }}
                placeholder="Optional id to capture call result"
              />
            </div>
            <div style={{ margin: '4px 0 6px 0', fontWeight: 600 }}>Parameters</div>
            {keys.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                {keys.map((k) => (
                  <React.Fragment key={k}>
                    <div style={{ alignSelf: 'center', opacity: 0.9 }}>{k}</div>
                    <input
                      type="text"
                      value={typeof inputs[k] === 'string' ? (inputs[k] as string) : JSON.stringify(inputs[k])}
                      onChange={(e) => onInputChange(k, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px' }}
                    />
                  </React.Fragment>
                ))}
              </div>
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