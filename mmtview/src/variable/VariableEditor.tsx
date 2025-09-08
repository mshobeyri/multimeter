import React, { useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import { jsonTypes } from "mmt-core/dist/CommonData";
import { Variable, Variables } from "./VariablesData";
import KVEditor from "../components/KVEditor";
import { safeList } from "mmt-core/dist/safer";

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

  const previousVariableNames = safeList(variables)
    .filter(v => v !== variable && v.name && v.name !== variable.name)
    .map(v => v.name);

  return (
    <div className="inner-box" >
      <div
        className="VariableEditor"
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <div className="label">name</div>
        <div style={{ padding: "8px" }}>
          <FieldWithRemove
            value={variable.name || ""}
            onChange={v => updateField({ name: v })}
            onRemovePressed={onRemove ?? (() => { })}
            placeholder="name"
          />
        </div>
        <div className="label">type</div>
        <div style={{ padding: "8px" }}>
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
        </div>
        {safeList(fieldOptions).map(opt =>
          variable[opt as keyof Variable] !== undefined ? (
            <div key={opt}>
              <div className="label">{opt}</div>
              <div style={{ padding: "8px", position: "relative" }}>
                <FieldWithRemove
                  value={variable[opt as keyof Variable] as string || ""}
                  onChange={v => updateField({ [opt]: v })}
                  onRemovePressed={() => removeOptionalField(opt as keyof Variable)}
                  placeholder={opt}
                />
              </div>
            </div>
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

        <div className="label">optional fields</div>
        {(availableOptionals.length > 0 || (variable.type === "object" || variable.type === "object[]")) && (
          <div style={{ padding: "5px" }}>
            <select
              value={addType}
              onChange={e => {
                if (e.target.value) handleAdd(e.target.value);
              }}
              style={{ width: "40%" }}
            >
              <option value="">optionals...</option>
              {safeList(availableOptionals).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariableEditor;