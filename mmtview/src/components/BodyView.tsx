import React, { useEffect, useState } from "react";
import { xml2js } from "xml-js";
import { beautify } from "mmt-core/markupConvertor";
import TextEditor from "../text/TextEditor";

export type mode = "appliable" | "live";

export type BodyViewProps = {
    value: string;
    format: string;
    onChange?: (value: string) => void;
    mode?: mode;
    onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
    refreshKey?: number;
};

const BodyView: React.FC<BodyViewProps> = ({ value, format, onChange, mode = "appliable", onInspectPosition, refreshKey }) => {
    const [localValue, setLocalValue] = useState(value);
    const [isValid, setIsValid] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [canApply, setCanApply] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Keep localValue in sync with parent value (when parent changes)
    useEffect(() => {
        setLocalValue(value);
    }, [value, refreshKey]);

    useEffect(() => {
        if (mode === "live" && onChange) {
            onChange(localValue);
        }
    }, [localValue]);

    // Validate JSON or XML when localValue or format changes
    useEffect(() => {
        let valid = true;
        let err: string | null = null;
        if (localValue === "") {
            setIsValid(true);
            return;
        }
        if (format === "json") {
            try {
                JSON.parse(localValue);
            } catch (e: any) {
                valid = false;
                err = e?.message || "Invalid JSON";
            }
        } else if (format === "xml") {
            try {
                xml2js(localValue, { compact: true });
            } catch (e: any) {
                valid = false;
                err = e?.message || "Invalid XML";
            }
        }
        setIsValid(valid);
        setErrorMsg(valid ? null : err);

        if (isValid && valid && beautify(format as "json" | "xml", localValue) !== value) {
            setCanApply(true);
        } else {
            setCanApply(false);
        }
        // eslint-disable-next-line
    }, [localValue, format, value, isValid]);

    // Exit fullscreen on Escape
    useEffect(() => {
        if (!isFullscreen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsFullscreen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isFullscreen]);

    return (
        <div
            className={`bodyview${isFullscreen ? " bodyview-fullscreen" : ""}`}
        >
            <TextEditor
                content={localValue}
                setContent={setLocalValue}
                language={format}
                showNumbers={false}
                fontSize={10}
                onFocusChange={setIsFocused}
                onInspectPosition={onInspectPosition}
            />
            <div className="bodyview-toolbar">
                {((format === "json" || format === "xml") && isValid && beautify(format, localValue) !== localValue) && (
                    <button
                        className="bodyview-btn-icon"
                        title="Beautify"
                        onClick={() => {
                            const beautified = beautify(format, localValue);
                            setLocalValue(beautified);
                        }}
                    >
                        <span className="codicon codicon-wand" />
                    </button>
                )}
                {mode === "appliable" && canApply && isValid && (
                    <button
                        className="bodyview-btn bodyview-btn-apply"
                        onClick={() => {
                            if (onChange) {
                                onChange(localValue);
                            }
                            setCanApply(false);
                        }}
                    >
                        Apply
                    </button>
                )}
                {!isValid && (
                    <span
                        className="bodyview-error-indicator"
                        title={errorMsg || (format === "json" ? "Invalid JSON" : format === "xml" ? "Invalid XML" : "Invalid")}
                    >
                        <span className="codicon codicon-error" />
                    </span>
                )}
                <button
                    className="bodyview-btn-icon"
                    title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
                    onClick={() => setIsFullscreen(!isFullscreen)}
                >
                    <span className={`codicon ${isFullscreen ? "codicon-screen-normal" : "codicon-screen-full"}`} />
                </button>
            </div>
        </div>
    );
};

export default BodyView;