import React, { useRef, useEffect, useState } from "react";
import { xml2js } from "xml-js";
import { beautify } from "mmt-core/markupConvertor";

export type mode = "interface" | "test";

export type DescriptionEditorProps = {
    value: string;
    onChange: (value: string) => void;
};

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({ value, onChange }) => {
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = useState(value);

    // Keep localValue in sync with parent value (when parent changes)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Auto-resize textarea height based on content
    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.style.height = "auto";
            bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
        }
    }, [localValue]);

    return (
        <div style={{ 
            width: "100%", // Subtract margin from width
            boxSizing: "border-box"
        }}>
            <textarea
                ref={bodyRef}
                value={localValue}
                onChange={e => {
                    setLocalValue(e.target.value);
                    onChange(e.target.value);
                }}
                onKeyDown={e => {
                    if (e.key === "Tab") {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const spaces = "  ";
                        textarea.setRangeText(spaces, start, end, "end");
                        setLocalValue(textarea.value);
                        onChange(textarea.value);
                    }
                    // Auto-resize on Enter
                    if (e.key === "Enter") {
                        setTimeout(() => {
                            if (bodyRef.current) {
                                bodyRef.current.style.height = "auto";
                                bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
                            }
                        }, 0);
                    }
                }}
                style={{
                    width: "100%",
                    resize: "none",
                    overflow: "hidden",
                    boxSizing: "border-box"
                }}
            />
        </div>
    );
};

export default DescriptionEditor;