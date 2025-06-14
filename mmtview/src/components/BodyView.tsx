import React, { useRef, useEffect, useState } from "react";
import { xml2js } from "xml-js";
import { beautify } from "../markupConvertor";

export type mode = "interface" | "test";

export type BodyViewProps = {
    value: string;
    format: string;
    onChange: (value: string) => void;
    mode?: mode;
};

const BodyView: React.FC<BodyViewProps> = ({ value, format, onChange, mode = "interface" }) => {
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const [localValue, setLocalValue] = useState(value);
    const [isValid, setIsValid] = useState(true);
    const [canApply, setCanApply] = useState(false);

    // Keep localValue in sync with parent value (when parent changes)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Validate JSON or XML when localValue or format changes
    useEffect(() => {
        let valid = true;
        if (format === "json") {
            try {
                JSON.parse(localValue);
            } catch {
                valid = false;
            }
        } else if (format === "xml") {
            try {
                xml2js(localValue, { compact: true });
            } catch {
                valid = false;
            }
        }
        setIsValid(valid);

        if (isValid && valid && beautify(format, localValue) !== value) {
            setCanApply(true);
        } else {
            setCanApply(false);
        }
        console.log(localValue, value);
        // eslint-disable-next-line
    }, [localValue, format, value, isValid]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.style.height = "auto";
            bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
        }
    }, [localValue]);

    return (
        <div style={{ position: "relative" }}>
            <textarea
                ref={bodyRef}
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Tab") {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const spaces = "  ";
                        textarea.setRangeText(spaces, start, end, "end");
                        setLocalValue(textarea.value);
                    }
                }}
                style={{
                    width: "100%",
                    minHeight: 60,
                    resize: "none",
                    overflow: "hidden"
                }}
            />
            {!isValid && (
                <span
                    style={{
                        position: "absolute",
                        right: 8,
                        bottom: 8,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "red",
                        display: "inline-block",
                        boxShadow: "0 0 2px #900"
                    }}
                    title={format === "json" ? "Invalid JSON" : format === "xml" ? "Invalid XML" : "Invalid"}
                />
            )}
            {mode == "interface" && canApply && isValid && (
                <button
                    style={{
                        position: "absolute",
                        right: 8,
                        bottom: 8,
                        background: "#43a047",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "2px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                        boxShadow: "0 0 2px #090"
                    }}
                    onClick={() => {
                        onChange(localValue);
                        setCanApply(false);
                    }}
                >
                    Apply
                </button>
            )}
        </div>
    );
};

export default BodyView;