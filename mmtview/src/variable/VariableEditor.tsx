import React, { useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import { jsonTypes } from "../api/APIData";
import { Variable, Variables } from "./VariablesData";
import KVEditor from "../components/KVEditor";

const fieldOptions = [
  "description", "default"
];

interface VariableEditorProps {
  variable: Variable;
  onChange: (v: Variable) => void;
  onRemove?: () => void;
  variables?: Variables;
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  variable,
  onChange,
  onRemove,
  variables = [],
}) => {
  const [addType, setAddType] = useState<string>("");

  const usedFields = new Set(
    fieldOptions.filter(opt => variable[opt as keyof Variable] !== undefined)
  );
  const availableOptionals = fieldOptions.filter(opt => !usedFields.has(opt));

  const updateField = (field: Partial<Variable>) => {
    let updated = { ...variable, ...field };
    // If type is changed and is not object/object[], remove fields
    if (
      field.type !== undefined &&
      field.type !== "object" &&
      field.type !== "object[]"
    ) {
      delete updated.fields;
    }
    onChange(updated);
  };

  const removeOptionalField = (fieldName: keyof Variable) => {
    const updated = { ...variable };
    delete updated[fieldName];
    onChange(updated);
  };

  const handleAdd = (type: string) => {
    updateField({ [type]: "" });
    setAddType("");
  };

  const previousVariableNames = variables
    ? variables
      .filter(v => v !== variable && v.name && v.name !== variable.name)
      .map(v => v.name)
    : [];

  return (
    <div
      style={{
        position: "relative",
        background: "var(--vscode-editorWidget-background, #232323)",
        border: "1px solid var(--vscode-editorWidget-border, #333)",
        borderRadius: "6px",
        padding: "16px",
        minWidth: 200,
        marginBottom: "16px"
      }}
    >
      <table
        className="VariableEditor"
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "80%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="label">name</td>
            <td style={{ padding: "8px" }}>
              <FieldWithRemove
                value={variable.name || ""}
                onChange={v => updateField({ name: v })}
                onRemovePressed={onRemove ?? (() => { })}
                placeholder="name"
              />
            </td>
          </tr>
          <tr>
            <td className="label">type</td>
            <td style={{ padding: "8px" }}>
              <ValidatableSelect
                value={variable.type || ""}
                options={[
                  ...jsonTypes,
                  ...previousVariableNames.flatMap(opt => [opt, `${opt}[]`])
                ]}
                onChange={val => updateField({ type: val })}
                showPlaceholder={true}
                placeholder="Select type..."
              />
            </td>
          </tr>
          {fieldOptions.map(opt =>
            variable[opt as keyof Variable] !== undefined ? (
              <tr key={opt}>
                <td className="label">{opt}</td>
                <td style={{ padding: "8px", position: "relative" }}>
                  <FieldWithRemove
                    value={variable[opt as keyof Variable] as string || ""}
                    onChange={v => updateField({ [opt]: v })}
                    onRemovePressed={() => removeOptionalField(opt as keyof Variable)}
                    placeholder={opt}
                  />
                </td>
              </tr>
            ) : null
          )}
          {(variable.type === "object" || variable.type === "object[]") && (
            <KVEditor
              label="fields"
              value={variable.fields || {}}
              onChange={fields => updateField({ fields })}
              keyPlaceholder="Field name"
              valuePlaceholder="Type"
              options={[
                ...jsonTypes,
                ...previousVariableNames.flatMap(opt => [opt, `${opt}[]`])
              ]}
            />
          )}
          {(availableOptionals.length > 0 || (variable.type === "object" || variable.type === "object[]")) && (
            <tr>
              <td colSpan={2} style={{ padding: "8px", paddingRight: "28px" }}>
                <select
                  value={addType}
                  onChange={e => {
                    if (e.target.value) handleAdd(e.target.value);
                  }}
                  style={{ width: "40%"}}
                >
                  <option value="">optionals...</option>
                  {availableOptionals.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default VariableEditor;