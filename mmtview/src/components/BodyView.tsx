import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { xml2js } from "xml-js";
import { beautify } from "mmt-core/markupConvertor";
import {
  findDisplayRuntimeTokenRanges,
  isJsonWithRuntimeTokensValid,
  isXmlWithRuntimeTokensValid,
} from "mmt-core/bodyRuntimeTokens";
import { extractPathAtPosition, PathSegment } from "mmt-core/outputExtractor";
import { normalizeNewlines } from "mmt-core/textLines";
import { shouldReplaceLocalEditorValue } from "../text/editorContentSync";
import TextEditor, { MMT_JSON_LANGUAGE_ID } from "../text/TextEditor";
import { useAccentChrome } from "../shared/useAccentChrome";

export type mode = "appliable" | "live";

const JSON_LIKE_BODY_FORMATS = new Set(["json", "multipart"]);

function isJsonLikeBodyFormat(format: string): boolean {
    return JSON_LIKE_BODY_FORMATS.has((format || "").toLowerCase());
}

function editorLanguageForBody(format: string): string {
    const normalized = (format || "").toLowerCase();
    if (normalized === "none" || normalized === "text") {
        return "plaintext";
    }
    if (normalized === "html") {
        return "html";
    }
    if (normalized.includes("xml")) {
        return "xml";
    }
    if (isJsonLikeBodyFormat(normalized)) {
        // JSON theme scopes + {{random/current …}} values (built-in json breaks keys).
        return MMT_JSON_LANGUAGE_ID;
    }
    return format;
}

export type BodyViewCursor = {
    lineNumber: number;
    column: number;
};

export type BodyViewProps = {
    value: string;
    format: string;
    onChange?: (value: string) => void;
    /**
     * When set, the first user keystroke/paste opens token edit elsewhere
     * instead of mutating this editor (keeps Ctrl+Z on the preview buffer).
     * Receives the caret position from the preview editor.
     */
    onStartEdit?: (cursor?: BodyViewCursor) => void;
    /** Fired when the Monaco editor loses focus. */
    onBlur?: () => void;
    /** Restore caret after mount (e.g. when swapping preview → edit editor). */
    initialCursor?: BodyViewCursor;
    mode?: mode;
    onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
    refreshKey?: number;
    disabled?: boolean;
};

const BodyView: React.FC<BodyViewProps> = ({
    value,
    format,
    onChange,
    onStartEdit,
    onBlur,
    initialCursor,
    mode = "appliable",
    onInspectPosition,
    refreshKey,
    disabled = false,
}) => {
    const [localValue, setLocalValue] = useState(value);
    const [isValid, setIsValid] = useState(true);
    const [canApply, setCanApply] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const isUserEditingRef = useRef(false);
    const editorRef = useRef<any>(null);
    const tokenDecorationsRef = useRef<string[]>([]);
    const [editorReady, setEditorReady] = useState(false);
    const [cursorPath, setCursorPath] = useState<{ path: PathSegment[]; expr: string; key: string } | null>(null);
    const cursorListenerRef = useRef<any>(null);
    const applyChrome = useAccentChrome("green");
    const errorChrome = useAccentChrome("red");

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

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !onBlur || typeof editor.onDidBlurEditorWidget !== "function") {
            return;
        }
        const disposable = editor.onDidBlurEditorWidget(() => {
            onBlur();
        });
        return () => {
            disposable?.dispose?.();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef.current, editorReady, onBlur]);

    // Restore caret + focus when this editor replaces another (preview → edit).
    useEffect(() => {
        if (!editorReady || !initialCursor) {
            return;
        }
        const editor = editorRef.current;
        if (!editor) {
            return;
        }
        const model = editor.getModel?.();
        const lineCount = model?.getLineCount?.() ?? 1;
        const lineNumber = Math.min(Math.max(1, initialCursor.lineNumber), lineCount);
        const maxColumn = model?.getLineMaxColumn?.(lineNumber) ?? 1;
        const column = Math.min(Math.max(1, initialCursor.column), maxColumn);
        const pos = { lineNumber, column };
        editor.setPosition?.(pos);
        editor.revealPositionInCenterIfOutsideViewport?.(pos);
        editor.focus?.();
    }, [editorReady, initialCursor]);

    // Keep localValue in sync with parent value (when parent changes).
    // Ignore EOL-only differences: live mode normalizes CRLF→LF for YAML, and
    // bouncing that back into Monaco resets the cursor to EOF.
    useEffect(() => {
        setLocalValue(prev => {
            if (!shouldReplaceLocalEditorValue(prev, value)) {
                return prev;
            }
            return value;
        });
    }, [value, refreshKey, format]);

    useEffect(() => {
        if (mode === "live" && onChange && isUserEditingRef.current) {
            isUserEditingRef.current = false;
            onChange(normalizeNewlines(localValue));
        }
    }, [localValue, mode, onChange]);

    // Validate JSON or XML when localValue or format changes
    useEffect(() => {
        let valid = true;
        let err: string | null = null;
        const isXmlLike = (format || "").includes("xml");
        if (localValue === "") {
            setIsValid(true);
            return;
        }
        if (isJsonLikeBodyFormat(format)) {
            if (!isJsonWithRuntimeTokensValid(localValue)) {
                valid = false;
                err = "Invalid JSON";
            }
        } else if (isXmlLike) {
            if (!isXmlWithRuntimeTokensValid(localValue, (xml) => {
                xml2js(xml, { compact: true });
            })) {
                valid = false;
                err = "Invalid XML";
            }
        }
        setIsValid(valid);
        setErrorMsg(valid ? null : err);

        if (isValid && valid && beautify(format as "json" | "xml" | "xmle" | "text" | "urlencoded" | "multipart", localValue) !== value) {
            setCanApply(true);
        } else {
            setCanApply(false);
        }
        // eslint-disable-next-line
    }, [localValue, format, value, isValid]);

    // Remounting BodyView (fullscreen portal) clears the editor; wait for onMount.
    useEffect(() => {
        setEditorReady(false);
    }, [isFullscreen]);

    // Badge highlight for {{random …}} / {{current …}} spans.
    useEffect(() => {
        if (!editorReady) {
            return;
        }
        const editor = editorRef.current;
        if (!editor || typeof editor.deltaDecorations !== "function") {
            return;
        }
        const ranges = findDisplayRuntimeTokenRanges(localValue);
        tokenDecorationsRef.current = editor.deltaDecorations(
            tokenDecorationsRef.current,
            ranges.map(range => ({
                range,
                options: {
                    inlineClassName: "mmt-body-runtime-token",
                    stickiness: 1, // NeverGrowsWhenTypingAtEdges
                },
            })),
        );
        return () => {
            if (typeof editor.deltaDecorations === "function") {
                tokenDecorationsRef.current = editor.deltaDecorations(
                    tokenDecorationsRef.current,
                    [],
                );
            }
        };
    }, [localValue, format, isFullscreen, editorReady]);

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

    useEffect(() => {
        if (!isFullscreen) {
            return;
        }

        const { body } = document;
        const previousOverflow = body.style.overflow;
        body.style.overflow = "hidden";

        return () => {
            body.style.overflow = previousOverflow;
        };
    }, [isFullscreen]);

    const content = (
        <div
            className={`bodyview${isFullscreen ? " bodyview-fullscreen" : ""}`}
        >
            <TextEditor
                content={localValue}
                setContent={(nextValue: string) => {
                    if (onStartEdit) {
                        const pos = editorRef.current?.getPosition?.();
                        // Keystroke already advanced the caret; we discard it and
                        // open tokens mode, so restore one column earlier.
                        onStartEdit(
                            pos
                                ? {
                                    lineNumber: pos.lineNumber,
                                    column: Math.max(1, pos.column - 1),
                                  }
                                : undefined,
                        );
                        return;
                    }
                    isUserEditingRef.current = true;
                    setLocalValue(nextValue);
                }}
                language={editorLanguageForBody(format)}
                showNumbers={false}
                fontSize={11}
                onInspectPosition={onInspectPosition}
                editorRef={editorRef}
                setEditorReady={setEditorReady}
                readOnly={disabled}
            />
            <div className="bodyview-toolbar">
                {!disabled && ((isJsonLikeBodyFormat(format) || (format || "").includes("xml")) && isValid && beautify(format as "json" | "xml" | "xmle" | "text" | "urlencoded" | "multipart", localValue) !== localValue) && (
                    <button
                        className="bodyview-btn-icon"
                        title="Beautify"
                        // Keep Monaco focused so parent blur handlers don't exit edit.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            const beautified = beautify(format as "json" | "xml" | "xmle" | "text" | "urlencoded" | "multipart", localValue);
                            isUserEditingRef.current = true;
                            setLocalValue(beautified);
                        }}
                    >
                        <span className="codicon codicon-wand" />
                    </button>
                )}
                {!disabled && mode === "appliable" && canApply && isValid && (
                    <button
                        className="bodyview-btn bodyview-btn-apply"
                        style={{
                            background: applyChrome.fill,
                            color: applyChrome.onFill,
                            border: `1px solid ${applyChrome.border}`,
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            if (onChange) {
                                onChange(normalizeNewlines(localValue));
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
                        style={{
                            background: errorChrome.fill,
                            color: errorChrome.onFill,
                            border: `1px solid ${errorChrome.border}`,
                            boxShadow: errorChrome.outline ? "none" : "0 2px 6px #0001",
                        }}
                        title={errorMsg || (isJsonLikeBodyFormat(format) ? "Invalid JSON" : (format || "").includes("xml") ? "Invalid XML" : "Invalid")}
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

    return isFullscreen ? createPortal(content, document.body) : content;
};

export default BodyView;
