import React, { useRef, useState } from "react";
import { safeList } from "mmt-core/safer";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from "../fileContext";

type LEditorFileFilter = {
    name: string;
    extensions: string[];
};

interface LEditorProps {
    label: string;
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    filePicker?: boolean;
    filePickerFilters?: LEditorFileFilter[];
}

const LEditor: React.FC<LEditorProps> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled,
    filePicker,
    filePickerFilters
}) => {
    const [newValue, setNewValue] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);
    const fileCtx = React.useContext(FileContext);

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
        }
    };

    const effectiveFilters: LEditorFileFilter[] = filePickerFilters || [{
        name: "Files",
        extensions: ["*"]
    }];

    return (<>
        <div className={disabled ? "label label-disabled" : "label"}>{label}</div>
        <div style={{ padding: "0", marginRight: "10px" }}>
            {safeList(value).map((val, idx) => (
                <div key={idx} style={{ width: "100%", padding: "5px" }}>
                    <FilePickerInput
                        value={val}
                        onChange={(v) => handleChange(idx, v)}
                        onEnterPressed={(v) => handleChange(idx, v)}
                        onRemovePressed={() => handleRemove(idx)}
                        basePath={fileCtx?.mmtFilePath}
                        filters={effectiveFilters}
                        disabled={disabled}
                        showFilePicker={!!filePicker}
                        removable
                        placeholder={placeholder || "Value"}
                    />
                </div>
            ))}
            <div style={{ width: "100%", padding: "5px" }}>
                <FilePickerInput
                    ref={inputRef}
                    value={newValue}
                    onChange={(v) => setNewValue(v)}
                    onEnterPressed={() => handleAdd()}
                    basePath={fileCtx?.mmtFilePath}
                    filters={effectiveFilters}
                    disabled={disabled}
                    showFilePicker={!!filePicker}
                    placeholder={placeholder || "Add new..."}
                />
            </div>
        </div>
    </>);
};

export default LEditor;