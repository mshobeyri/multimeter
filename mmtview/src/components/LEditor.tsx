import React, { useRef, useEffect, useState } from "react";
import FieldWithRemove from "./FieldWithRemove";
import { safeList } from "mmt-core/safer";

interface LEditorProps {
    label: string,
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

// Note: We use an explicit "new item" input row instead of a trailing empty field.

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
        const updated = safeList(value).map((v, i) => (i === idx ? newVal : v));
        onChange(updated.filter(v => v !== ""));
    };

    const handleRemove = (idx: number) => {
        const updated = safeList(value).filter((_, i) => i !== idx);
        onChange(updated);
    };

    const handleAdd = () => {
        if (newValue.trim() !== "") {
            onChange([...value, newValue]);
            setNewValue("");
            // Focus will be handled by useEffect
        }
    };

    return (<>
        <div className={disabled ? "label label-disabled" : "label"}>{label}</div>
        <div style={{ padding: "0", marginRight: "10px" }}>
            {safeList(value).map((val, idx) => (
                <div key={idx} style={{ width: "100%", padding: "5px"}}>
                    <FieldWithRemove
                        value={val}
                        onChange={v => handleChange(idx, v)}
                        onRemovePressed={() => handleRemove(idx)}
                        placeholder={placeholder || "Value"}
                        disabled={disabled}
                    />
                </div>
            ))}
            <div style={{ width: "100%", padding: "5px"}}>
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
            </div>
        </div>
    </>
    );
};

export default LEditor;