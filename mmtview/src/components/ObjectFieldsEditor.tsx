import React, { useState } from "react";
import ValidatableSelect from "./ValidatableSelect";
import { safeList } from "mmt-core/safer";

interface ObjectFieldsEditorProps {
    fields: Record<string, string>;
    setFields: (fields: Record<string, string>) => void;
    typeOptions: string[];
}

const ObjectFieldsEditor: React.FC<ObjectFieldsEditorProps> = ({ fields, setFields, typeOptions }) => {
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>("");

    const handleRemove = (name: string) => {
        const { [name]: _, ...rest } = fields;
        setFields(rest);
    };

    const startEditing = (name: string) => {
        setEditingField(name);
        setEditingValue(name);
    };

    // Live update: rename field as user types
    const handleLiveEdit = (oldName: string, newName: string) => {
        setEditingValue(newName);
        if (!newName || newName === oldName) return;
        if (fields[newName]) return; // prevent duplicate
        // Preserve order: rebuild fields in original order, replacing oldName with newName
        const entries = Object.entries(fields);
        const newFields: Record<string, string> = {};
        for (const [k, v] of entries) {
            if (k === oldName) {
                newFields[newName] = v;
            } else {
                newFields[k] = v;
            }
        }
        setFields(newFields);
        setEditingField(newName);
    };

    const handleTypeChange = (name: string, newType: string) => {
        // Preserve order: rebuild fields in original order, updating type for 'name'
        const entries = Object.entries(fields);
        const newFields: Record<string, string> = {};
        for (const [k, v] of entries) {
            newFields[k] = k === name ? newType : v;
        }
        setFields(newFields);
    };

    // Do NOT sort fields; keep YAML/native order
    const orderedFields = Object.entries(fields);

    return (
        <div>
            <div className="object-fields-title">Fields</div>
            {safeList(orderedFields).map(([name, type]) => (
                <div key={name} className="object-field-row">
                    {editingField === name ? (
                        <input
                            type="text"
                            placeholder="Field name"
                            value={editingValue}
                            autoFocus
                            onChange={e => handleLiveEdit(name, e.target.value)}
                            onBlur={() => setEditingField(null)}
                            className="object-field-name"
                        />
                    ) : (
                        <input
                            type="text"
                            value={name}
                            readOnly
                            onFocus={() => startEditing(name)}
                            className="object-field-name"
                        />
                    )}
                    <div className="object-field-type">
                        <ValidatableSelect
                            value={type}
                            options={typeOptions.filter(opt => opt !== "object" && opt !== "object[]")}
                            onChange={val => handleTypeChange(name, val)}
                            showPlaceholder={true}
                            placeholder="Select type..."
                        />
                        <button
                            onClick={() => handleRemove(name)}
                            className="field-button"
                            title="Remove field"
                        ><span className="codicon codicon-trash"></span></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ObjectFieldsEditor;
