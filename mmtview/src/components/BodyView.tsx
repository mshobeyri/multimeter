import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { xml2js } from "xml-js";
import { useAccentChrome } from "../shared/useAccentChrome";
import { beautify } from "mmt-core/markupConvertor";
import {
  findBodyTokenHoverRanges,
  isJsonWithRuntimeTokensValid,
  isXmlWithRuntimeTokensValid,
  type BodyTokenHoverRange,
  type RuntimeTokenValueContext,
} from "mmt-core/bodyRuntimeTokens";
import { extractPathAtPosition, PathSegment } from "mmt-core/outputExtractor";
import { wrapTypedTokenAtCursor } from "mmt-core/apiBodyEdit";
import { normalizeNewlines } from "mmt-core/textLines";
import { shouldReplaceLocalEditorValue } from "../text/editorContentSync";
import TextEditor, { MMT_JSON_LANGUAGE_ID } from "../text/TextEditor";
import {
  cacheBodyLineNumbers,
  readCachedBodyLineNumbers,
  requestEditorConfig,
  setBodyLineNumbersConfig,
} from "../api/bodyLineNumbersConfig";

export type mode = "appliable" | "live";

const JSON_LIKE_BODY_FORMATS = new Set(["json", "multipart"]);

function isJsonLikeBodyFormat(format: string): boolean {
    return JSON_LIKE_BODY_FORMATS.has((format || "").toLowerCase());
}

function positionInHoverRange(
    pos: { lineNumber: number; column: number },
    range: BodyTokenHoverRange,
): boolean {
    if (pos.lineNumber < range.startLineNumber || pos.lineNumber > range.endLineNumber) {
        return false;
    }
    if (pos.lineNumber === range.startLineNumber && pos.column < range.startColumn) {
        return false;
    }
    if (pos.lineNumber === range.endLineNumber && pos.column > range.endColumn) {
        return false;
    }
    return true;
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

export type BodyViewToolbarState = {
    isValid: boolean;
    errorMessage: string | null;
    canBeautify: boolean;
    canApply: boolean;
    canInspect: boolean;
    beautify: () => void;
    apply: () => void;
    inspect: () => void;
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
    /** Inputs/env for JSON i:/e: quoting when beautifying. */
    valueContext?: RuntimeTokenValueContext;
    /**
     * Token-form body text (`{{i:…}}` / …). When set, resolved i:/e: values in
     * the display are underlined and hover shows the token key.
     */
    tokenTemplate?: string;
    /** Structured YAML body with tokens — pairs with resolvedBody for r:/c: underlines. */
    tokenSource?: unknown;
    /** Structured resolved body (request preview) for r:/c: / i:/e: underlines. */
    resolvedBody?: unknown;
    mode?: mode;
    onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
    onToolbarChange?: (toolbar: BodyViewToolbarState | null) => void;
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
    valueContext,
    tokenTemplate,
    tokenSource,
    resolvedBody,
    mode = "appliable",
    onInspectPosition,
    onToolbarChange,
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
    const tokenHoverRangesRef = useRef<BodyTokenHoverRange[]>([]);
    const [tokenHoverTip, setTokenHoverTip] = useState<{
        text: string;
        left: number;
        top: number;
    } | null>(null);
    /**
     * Last user-placed caret (click / arrows). Not updated when a keystroke
     * moves the caret — that way resolved→tokens opens at the pre-key position
     * (backspace must not land one column earlier).
     */
    const preEditCursorRef = useRef<BodyViewCursor | undefined>(undefined);
    const [editorReady, setEditorReady] = useState(false);
    const [cursorPath, setCursorPath] = useState<{ path: PathSegment[]; expr: string; key: string } | null>(null);
    const [showLineNumbers, setShowLineNumbers] = useState<boolean>(() => readCachedBodyLineNumbers());
    const showLineNumbersRef = useRef(showLineNumbers);
    showLineNumbersRef.current = showLineNumbers;
    const cursorListenerRef = useRef<any>(null);

    useEffect(() => {
      requestEditorConfig();
      const handleConfig = (message: any) => {
        if (typeof message?.bodyLineNumbers !== "boolean") {
          return;
        }
        cacheBodyLineNumbers(message.bodyLineNumbers);
        setShowLineNumbers(message.bodyLineNumbers);
      };
      const onMessage = (event: MessageEvent) => {
        if (event.data?.command === "config") {
          handleConfig(event.data);
        }
      };
      const onConfigEvent = (event: Event) => {
        handleConfig((event as CustomEvent).detail);
      };
      window.addEventListener("message", onMessage);
      window.addEventListener("multimeter.config", onConfigEvent);
      return () => {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("multimeter.config", onConfigEvent);
      };
    }, []);

    // Keep Monaco’s cut/copy/paste/format menu; add line-numbers as an extra action.
    useEffect(() => {
      if (!editorReady) {
        return;
      }
      const editor = editorRef.current;
      if (!editor || typeof editor.addAction !== "function") {
        return;
      }
      const existing = typeof editor.getAction === "function"
        ? editor.getAction("mmt.toggleBodyLineNumbers")
        : null;
      if (existing && typeof existing.dispose === "function") {
        existing.dispose();
      }
      const disposable = editor.addAction({
        id: "mmt.toggleBodyLineNumbers",
        label: showLineNumbers ? "Hide Line Numbers" : "Show Line Numbers",
        contextMenuGroupId: "mmt",
        contextMenuOrder: 1,
        run: () => {
          const next = !showLineNumbersRef.current;
          setShowLineNumbers(next);
          setBodyLineNumbersConfig(next);
        },
      });
      return () => {
        if (disposable && typeof disposable.dispose === "function") {
          disposable.dispose();
        }
      };
    }, [editorReady, showLineNumbers, isFullscreen]);

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

    // Track user-placed caret only. Content-driven moves (type/backspace) must
    // not overwrite this — onStartEdit restores this pre-key position.
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !onStartEdit || typeof editor.onDidChangeCursorPosition !== "function") {
            return;
        }
        const store = (pos: { lineNumber: number; column: number } | null | undefined) => {
            if (!pos) {
                return;
            }
            preEditCursorRef.current = {
                lineNumber: pos.lineNumber,
                column: pos.column,
            };
        };
        store(editor.getPosition?.());
        // monaco.editor.CursorChangeReason.Explicit === 3
        const Explicit = 3;
        const disposable = editor.onDidChangeCursorPosition((e: {
            reason?: number;
            position?: { lineNumber: number; column: number };
        }) => {
            // Ignore content-driven caret moves (type / backspace / delete).
            if (e.reason !== Explicit) {
                return;
            }
            store(e.position);
        });
        return () => {
            disposable?.dispose?.();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef.current, editorReady, onStartEdit]);

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

    const applyChrome = useAccentChrome("green");
    const beautifyBody = useCallback((text: string) => {
        return beautify(
            format as "json" | "xml" | "xmle" | "text" | "urlencoded" | "multipart",
            text,
            valueContext,
        );
    }, [format, valueContext]);

    const beautifyCurrentBody = useCallback(() => {
        const beautified = beautifyBody(localValue);
        isUserEditingRef.current = true;
        setLocalValue(beautified);
    }, [beautifyBody, localValue]);

    const applyCurrentBody = useCallback(() => {
        if (onChange) {
            onChange(normalizeNewlines(localValue));
        }
        setCanApply(false);
    }, [localValue, onChange]);

    const inspectCurrentPosition = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || !onInspectPosition) {
            return;
        }
        const pos = editor.getPosition();
        if (!pos) {
            return;
        }
        onInspectPosition({
            line: pos.lineNumber,
            column: pos.column,
            text: editor.getValue(),
        });
    }, [onInspectPosition]);

    const canBeautify = !disabled &&
        (isJsonLikeBodyFormat(format) || (format || "").includes("xml")) &&
        isValid && beautifyBody(localValue) !== localValue;

    useEffect(() => {
        if (!onToolbarChange) {
            return;
        }
        onToolbarChange({
            isValid,
            errorMessage: errorMsg,
            canBeautify,
            canApply: !disabled && mode === "appliable" && canApply && isValid,
            canInspect: Boolean(onInspectPosition && cursorPath),
            beautify: beautifyCurrentBody,
            apply: applyCurrentBody,
            inspect: inspectCurrentPosition,
        });
        return () => onToolbarChange(null);
    }, [
        onToolbarChange,
        isValid,
        errorMsg,
        canBeautify,
        disabled,
        mode,
        canApply,
        onInspectPosition,
        cursorPath,
        beautifyCurrentBody,
        applyCurrentBody,
        inspectCurrentPosition,
    ]);

    // Validate JSON or XML when localValue or format changes
    useEffect(() => {
        let valid = true;
        let err: string | null = null;
        const isXmlLike = (format || "").includes("xml");
        if (localValue === "") {
            setIsValid(true);
            setErrorMsg(null);
            setCanApply(false);
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

        if (isValid && valid && beautifyBody(localValue) !== value) {
            setCanApply(true);
        } else {
            setCanApply(false);
        }
        // eslint-disable-next-line
    }, [localValue, format, value, isValid, beautifyBody]);

    // Remounting BodyView (fullscreen portal) clears the editor; wait for onMount.
    useEffect(() => {
        setEditorReady(false);
    }, [isFullscreen]);

    // Underline token / resolved-from-token spans; custom tip shows the pair.
    useEffect(() => {
        if (!editorReady) {
            return;
        }
        const editor = editorRef.current;
        if (!editor || typeof editor.deltaDecorations !== "function") {
            return;
        }
        const ranges = findBodyTokenHoverRanges(localValue, {
            tokenTemplate,
            valueContext,
            tokenSource,
            resolvedBody,
        });
        tokenHoverRangesRef.current = ranges.filter(r => Boolean(r.tooltip?.trim()));
        tokenDecorationsRef.current = editor.deltaDecorations(
            tokenDecorationsRef.current,
            ranges.map(range => ({
                range: {
                    startLineNumber: range.startLineNumber,
                    startColumn: range.startColumn,
                    endLineNumber: range.endLineNumber,
                    endColumn: range.endColumn,
                },
                options: {
                    inlineClassName: range.kind === "resolved"
                        ? "mmt-body-runtime-token is-resolved"
                        : "mmt-body-runtime-token is-token",
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
            tokenHoverRangesRef.current = [];
            setTokenHoverTip(null);
        };
    }, [localValue, format, isFullscreen, editorReady, tokenTemplate, valueContext, tokenSource, resolvedBody]);

    // Fit-to-content hover tip (Monaco's hover widget scrolls / pads oddly).
    useEffect(() => {
        if (!editorReady) {
            return;
        }
        const editor = editorRef.current;
        if (!editor || typeof editor.onMouseMove !== "function") {
            return;
        }
        const move = editor.onMouseMove((e: {
            target?: { position?: { lineNumber: number; column: number } | null };
        }) => {
            const pos = e.target?.position;
            if (!pos) {
                setTokenHoverTip(null);
                return;
            }
            const hit = tokenHoverRangesRef.current.find(r => positionInHoverRange(pos, r));
            const tip = hit?.tooltip?.trim();
            if (!hit || !tip || typeof editor.getScrolledVisiblePosition !== "function") {
                setTokenHoverTip(null);
                return;
            }
            const coords = editor.getScrolledVisiblePosition({
                lineNumber: hit.startLineNumber,
                column: hit.startColumn,
            });
            if (!coords) {
                setTokenHoverTip(null);
                return;
            }
            const editorDom = typeof editor.getDomNode === "function" ? editor.getDomNode() : null;
            const editorRect = editorDom?.getBoundingClientRect();
            if (!editorRect) {
                setTokenHoverTip(null);
                return;
            }
            setTokenHoverTip({
                text: tip,
                left: editorRect.left + coords.left,
                top: editorRect.top + coords.top + coords.height + 4,
            });
        });
        const leave = typeof editor.onMouseLeave === "function"
            ? editor.onMouseLeave(() => setTokenHoverTip(null))
            : null;
        return () => {
            move?.dispose?.();
            leave?.dispose?.();
            setTokenHoverTip(null);
        };
    }, [editorReady, isFullscreen]);

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
                        // Discard the keystroke; open tokens at the pre-key caret.
                        onStartEdit(preEditCursorRef.current);
                        return;
                    }
                    isUserEditingRef.current = true;
                    setLocalValue(nextValue);
                }}
                language={editorLanguageForBody(format)}
                showNumbers={showLineNumbers}
                fontSize={11}
                onInspectPosition={onInspectPosition}
                editorRef={editorRef}
                setEditorReady={setEditorReady}
                readOnly={disabled}
                rewriteTypedValue={disabled || onStartEdit ? undefined : wrapTypedTokenAtCursor}
            />
            {tokenHoverTip ? createPortal(
                <div
                    className="token-hover-tip"
                    style={{ left: tokenHoverTip.left, top: tokenHoverTip.top }}
                    role="tooltip"
                >
                    {tokenHoverTip.text}
                </div>,
                document.body,
            ) : null}
            <div className="bodyview-toolbar">
                {canBeautify ? (
                    <button
                        type="button"
                        className="button-icon no-shrink section-edit-toggle"
                        title="Beautify"
                        aria-label="Beautify body"
                        onMouseDown={event => event.preventDefault()}
                        onClick={beautifyCurrentBody}
                    >
                        <span className="codicon codicon-wand" aria-hidden />
                    </button>
                ) : null}
                {!disabled && mode === "appliable" && canApply && isValid ? (
                    <button
                        type="button"
                        className="bodyview-btn bodyview-btn-apply"
                        style={{
                            background: applyChrome.fill,
                            color: applyChrome.onFill,
                            border: `1px solid ${applyChrome.border}`,
                        }}
                        onMouseDown={event => event.preventDefault()}
                        onClick={applyCurrentBody}
                    >
                        Apply
                    </button>
                ) : null}
                <button
                    type="button"
                    className="button-icon no-shrink section-edit-toggle"
                    title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
                    aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => setIsFullscreen(current => !current)}
                >
                    <span
                        className={`codicon ${isFullscreen ? "codicon-screen-normal" : "codicon-screen-full"}`}
                        aria-hidden
                    />
                </button>
            </div>
        </div>
    );

    return isFullscreen ? createPortal(content, document.body) : content;
};

export default BodyView;
