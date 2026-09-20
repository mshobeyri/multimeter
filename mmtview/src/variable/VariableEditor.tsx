import React, { useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import { jsonTypes } from "mmt-core/CommonData";
import { Variable, Variables } from "./VariablesData";
import KSVEditor from "../components/KSVEditor";
import { safeList } from "mmt-core/safer";

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
    <div className="inner-box">
      <div className="mmt-fill">
        <div className="label">Name</div>
        <div className="field-pad-lg">
          <FieldWithRemove
            value={variable.name || ""}
            onChange={v => updateField({ name: v })}
            onRemovePressed={onRemove ?? (() => { })}
            placeholder="name"
          />
        </div>
        <div className="label">Type</div>
        <div className="field-pad-lg">
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
              <div className="field-pad-lg is-relative">
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
          <KSVEditor
            label="Fields"
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

        <div className="label">Optional fields</div>
        {(availableOptionals.length > 0 || (variable.type === "object" || variable.type === "object[]")) && (
          <div className="field-pad">
            <select
              value={addType}
              onChange={e => {
                if (e.target.value) handleAdd(e.target.value);
              }}
              className="select-narrow"
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
