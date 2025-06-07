import React, { useState } from "react";

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
            <div style={{ marginBottom: 8, fontWeight: 500 }}>fields</div>
            {orderedFields.map(([name, type]) => (
                <div
                    key={name}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: 4,
                        width: "100%",
                    }}
                >
                    {editingField === name ? (
                        <input
                            type="text"
                            placeholder="Field name"
                            value={editingValue}
                            autoFocus
                            onChange={e => handleLiveEdit(name, e.target.value)}
                            onBlur={() => setEditingField(null)}
                            style={{
                                width: "40%",
                                verticalAlign: "top",
                                padding: "6px 8px",
                            }}
                        />
                    ) : (
                        <input
                            type="text"
                            value={name}
                            readOnly
                            onFocus={() => startEditing(name)}
                            style={{
                                width: "40%",
                                verticalAlign: "top",
                                padding: "6px 8px",
                            }}
                        />
                    )}
                    <div style={{
                        marginLeft: 8,
                        width: "60%",
                        display: "flex",
                        alignItems: "center",
                    }}>
                        <select
                            value={type}
                            onChange={e => handleTypeChange(name, e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: 100,
                                boxSizing: "border-box",
                            }}
                        >
                            {typeOptions
                                .filter(opt => opt !== "object" && opt !== "object[]")
                                .map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                        </select>
                        <button
                            onClick={() => handleRemove(name)}
                            style={{
                                width: 28,
                                height: 28,
                                marginLeft: 4,
                                background: "none",
                                color: "#c00",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            title="Remove field"
                        >🗑️</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ObjectFieldsEditor;