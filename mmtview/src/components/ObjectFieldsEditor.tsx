import React, { useState } from "react";

interface ObjectFieldsEditorProps {
    fields: Record<string, string>;
    setFields: (fields: Record<string, string>) => void;
    typeOptions: string[];
}

const ObjectFieldsEditor: React.FC<ObjectFieldsEditorProps> = ({ fields, setFields, typeOptions }) => {
    const [newField, setNewField] = useState({ name: "", type: "" });

    const handleAdd = () => {
        if (!newField.name || !newField.type) return;
        setFields({ ...fields, [newField.name]: newField.type });
        setNewField({ name: "", type: "" });
    };

    const handleRemove = (name: string) => {
        const { [name]: _, ...rest } = fields;
        setFields(rest);
    };

    return (
        <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>fields</div>
            {Object.entries(fields).map(([name, type]) => (
                <div
                    key={name}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: 4,
                        width: "100%",
                    }}
                >
                    <input
                        value={name}
                        disabled
                        style={{
                            width: "40%",
                            minWidth: 80,
                            marginRight: 8,
                            boxSizing: "border-box",
                        }}
                    />
                    <div style={{
                        marginLeft: 8,
                        width: "60%",
                        display: "flex",
                        alignItems: "center",
                    }}>
                        <select
                            value={type}
                            disabled
                            style={{
                                flex: 1,
                                minWidth: 100,
                                boxSizing: "border-box",
                            }}
                        >
                            {typeOptions.map(opt => (
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