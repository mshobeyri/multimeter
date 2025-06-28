import React, { useMemo, useRef, useEffect, useState } from "react";
import FieldWithRemove from "./FieldWithRemove";

interface LEditorProps {
    label: string,
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

// Helper: always show a trailing empty field for editing, but don't store it in value
function withTrailingEmpty(arr: string[]): string[] {
    return arr;
}

const LEditor: React.FC<LEditorProps> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled
}) => {
    const [newValue, setNewValue] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Focus the new input when a new item is added
    useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.value = "";
        }
    }, [value.length]);

    const handleChange = (idx: number, newVal: string) => {
        const updated = value.map((v, i) => (i === idx ? newVal : v));
        onChange(updated.filter(v => v !== ""));
    };

    const handleRemove = (idx: number) => {
        const updated = value.filter((_, i) => i !== idx);
        onChange(updated);
    };

    const handleAdd = () => {
        if (newValue.trim() !== "") {
            onChange([...value, newValue]);
            setNewValue("");
            // Focus will be handled by useEffect
        }
    };

    return (
        <tr>
            <td className={disabled ? "label label-disabled" : "label"}>{label}</td>
            <td style={{ padding: "5px" }}>
            <table style={{ width: "100%" }}>
                <tbody>
                    {value.map((val, idx) => (
                        <tr key={idx}>
                            <td style={{ width: "90%" }}>
                                <FieldWithRemove
                                    value={val}
                                    onChange={v => handleChange(idx, v)}
                                    onRemovePressed={() => handleRemove(idx)}
                                    placeholder={placeholder || "Value"}
                                    disabled={disabled}
                                />
                            </td>
                        </tr>
                    ))}
                    {/* Always show an empty input at the end for adding new items */}
                    <tr>
                        <td style={{ width: "90%" }}>
                            <input
                                ref={inputRef}
                                value={newValue}
                                onChange={e => setNewValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                                placeholder={placeholder || "Value"}
                                disabled={disabled}
                                style={{
                                    width: "100%"
                                }}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </td>
    </tr >
  );
};

export default LEditor;