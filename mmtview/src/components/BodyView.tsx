import React, { useCallback, useEffect, useRef, useState } from "react";
import { xml2js } from "xml-js";
import { beautify } from "mmt-core/markupConvertor";
import { extractPathAtPosition, PathSegment } from "mmt-core/outputExtractor";
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
    const [canApply, setCanApply] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const isUserEditingRef = useRef(false);
    const editorRef = useRef<any>(null);
    const [cursorPath, setCursorPath] = useState<{ path: PathSegment[]; expr: string; key: string } | null>(null);
    const cursorListenerRef = useRef<any>(null);

    const detectContentType = useCallback((text: string): "json" | "xml" => {
        const fmt = (format || "json").toLowerCase();
        return fmt.includes("xml") || text.trim().startsWith("<") ? "xml" : "json";
    }, [format]);

    const computePathAtCursor = useCallback((editor: any) => {
        if (!onInspectPosition || !editor) {
            setCursorPath(null);
            return;
        }
        const pos = editor.getPosition();
        if (!pos) {
            setCursorPath(null);
            return;
        }
        const text = editor.getValue();
        const contentType = detectContentType(text);
        const path = extractPathAtPosition(text, contentType, pos.lineNumber, pos.column);
        if (!path || path.length === 0) {
            setCursorPath(null);
            return;
        }
        const expr = "body" + path.map(seg => `[${String(seg)}]`).join("");
        let key = "value";
        for (let i = path.length - 1; i >= 0; i--) {
            const seg = path[i];
            if (typeof seg === "string" && seg.trim()) {
                key = seg;
                break;
            }
        }
        setCursorPath({ path, expr, key });
    }, [onInspectPosition, detectContentType]);

    // Attach cursor position listener when editor mounts
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !onInspectPosition) {
            return;
        }
        // Compute once for initial position
        computePathAtCursor(editor);
        // Listen for cursor changes
        cursorListenerRef.current = editor.onDidChangeCursorPosition?.(() => {
            computePathAtCursor(editor);
        });
        return () => {
            cursorListenerRef.current?.dispose();
            cursorListenerRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef.current, onInspectPosition, computePathAtCursor]);

    // Keep localValue in sync with parent value (when parent changes)
    useEffect(() => {
        setLocalValue(value);
        setCursorPath(null);
    }, [value, refreshKey]);

    useEffect(() => {
        if (mode === "live" && onChange && isUserEditingRef.current) {
            isUserEditingRef.current = false;
            onChange(localValue);
        }
    }, [localValue, mode, onChange]);

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
                setContent={(nextValue: string) => {
                    isUserEditingRef.current = true;
                    setLocalValue(nextValue);
                }}
                language={format}
                showNumbers={false}
                fontSize={11}
                onInspectPosition={onInspectPosition}
                editorRef={editorRef}
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
                {onInspectPosition && cursorPath && (
                    <button
                        className="bodyview-btn-icon"
                        title={`Add output: ${cursorPath.key} = ${cursorPath.expr}`}
                        onClick={() => {
                            const editor = editorRef.current;
                            if (!editor) {
                                return;
                            }
                            const pos = editor.getPosition();
                            if (!pos) {
                                return;
                            }
                            const text = editor.getValue();
                            onInspectPosition({ line: pos.lineNumber, column: pos.column, text });
                        }}
                    >
                        <span className="codicon codicon-sign-out" />
                    </button>
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