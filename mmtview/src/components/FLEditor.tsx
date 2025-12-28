import React, { useRef, useEffect, useState, useContext } from "react";
import { safeList } from "mmt-core/safer";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';

interface FLEditorProps {
    label: string,
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

// Note: We use an explicit "new item" input row instead of a trailing empty field.

const FLEditor: React.FC<FLEditorProps> = ({
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

    const handleAdd = (newValue: string) => {
        if (newValue.trim() !== "") {
            onChange([...value, newValue]);
            setNewValue("");
        }
    };

    const fileCtx = useContext(FileContext);

    return (<>
        <div className={disabled ? "label label-disabled" : "label"}>{label}</div>
        <div style={{ padding: "0", marginRight: "10px" }}>
            {safeList(value).map((val, idx) => (
                <div key={idx} style={{ width: "100%", padding: "5px" }}>
                    <FilePickerInput
                        value={val}
                        basePath={fileCtx?.mmtFilePath}
                        onChange={v => handleChange(idx, v)}
                        filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
                        allowFolders={true}
                        onRemovePressed={() => handleRemove(idx)}
                    />
                </div>
            ))}
            <div style={{ width: "100%", padding: "5px" }}>
                <FilePickerInput
                    ref={inputRef}
                    filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
                    value={newValue}
                    allowFolders={true}
                    basePath={fileCtx?.mmtFilePath}
                    onChange={e => { setNewValue(e); }}
                    onEnterPressed={e => { handleAdd(e); }}
                />
            </div>
        </div>
    </>
    );
};

export default FLEditor;