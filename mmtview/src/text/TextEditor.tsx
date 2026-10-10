import React, { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { computeMinimalEditSpan, planExternalMonacoApply } from "./editorContentSync";
import { defineTheme, getMonacoThemeName } from "./Theme";

interface TextEditorProps {
  content: string;
  setContent: (value: string) => void;
  language?: string;
  showNumbers?: boolean;
  fontSize?: number;
  beforeMount?: (monaco: any) => void;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  setEditorReady?: (ready: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
  onToggleRunButton?: () => void;
  onPasteTextTransform?: (text: string) => string | null | undefined;
  /**
   * Rewrite the buffer after a keystroke. Used to wrap `i:x` as `{{i:x}}`
   * and return the caret offset in the rewritten text.
   */
  rewriteTypedValue?: (text: string, cursor: number) => { text: string; cursor: number };
  showGlyphMargin?: boolean;
  readOnly?: boolean;
  /** Monaco built-in context menu. Default true. */
  enableContextMenu?: boolean;
}

const I_PREFIX_CLASS = "monaco-i-prefix-highlight";
const YAML_CONSTANT_CLASS = "mmt-yaml-constant";

let graphqlRegistered = false;
function registerGraphQLLanguage(monaco: any) {
  if (graphqlRegistered) { return; }
  graphqlRegistered = true;
  monaco.languages.register({ id: "graphql" });
  monaco.languages.setMonarchTokensProvider("graphql", {
    keywords: ["query", "mutation", "subscription", "fragment", "on", "type", "input", "enum",
      "scalar", "interface", "union", "extend", "implements", "directive", "schema",
      "true", "false", "null"],
    typeKeywords: ["Int", "Float", "String", "Boolean", "ID"],
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/"""/, "string", "@blockString"],
        [/\$\w+/, "variable"],
        [/@\w+/, "annotation"],
        [/[{}()[\]]/, "delimiter.bracket"],
        [/[!:=|&]/, "delimiter"],
        [/\b\d+\b/, "number"],
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@default": "identifier"
          }
        }],
      ],
      blockString: [
        [/"""/, "string", "@pop"],
        [/./, "string"],
      ],
    },
  });
}

let urlencodedRegistered = false;
function registerUrlEncodedLanguage(monaco: any) {
  if (urlencodedRegistered) {
    return;
  }
  urlencodedRegistered = true;
  monaco.languages.register({ id: "urlencoded" });
  // Use YAML/JSON theme tokens: `key` (green) and `string` (orange).
  monaco.languages.setMonarchTokensProvider("urlencoded", {
    tokenizer: {
      root: [
        [/\s+/, "white"],
        // key=value (value may be empty)
        [/([^&\s=]+)(=)([^&]*)/, ["key", "delimiter", "string"]],
        // bare key (no = yet)
        [/[^&\s=]+/, "key"],
        [/[=&]/, "delimiter"],
      ],
    },
  });
}

/**
 * JSON body language: emit the same scopes as Monaco's built-in JSON tokenizer
 * (`string.key.json`, `string.value.json`, …) so Theme key colors apply, plus
 * bare `{{random …}}` / `{{current …}}` as values. Built-in `json` breaks on
 * those and loses key highlighting for the rest of the document.
 *
 * tokenPostfix must be "" — default would be `.mmt-json`, which would make
 * keys `string.key.mmt-json` and fall through to the generic `string` color.
 */
let mmtJsonLanguageIdRegistered = false;
export const MMT_JSON_LANGUAGE_ID = "mmt-json";
function registerMmtJsonLanguage(monaco: any) {
  if (!mmtJsonLanguageIdRegistered) {
    if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === MMT_JSON_LANGUAGE_ID)) {
      monaco.languages.register({ id: MMT_JSON_LANGUAGE_ID });
    }
    mmtJsonLanguageIdRegistered = true;
  }
  monaco.languages.setLanguageConfiguration(MMT_JSON_LANGUAGE_ID, {
    brackets: [
      ["{", "}"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
  });
  // Full scope names (same as monaco jsonMode.js). Empty postfix is required.
  monaco.languages.setMonarchTokensProvider(MMT_JSON_LANGUAGE_ID, {
    defaultToken: "",
    tokenPostfix: "",
    tokenizer: {
      root: [
        [/\s+/, ""],
        // Whole {{…}} as one token (before `{`) so braces/words/numbers stay uniform.
        // Allow parenthesized args; stop at first `}` that isn't inside `(…)`.
        [/\{\{\s*(?:random|current)\s+(?:[^{}]|\([^)]*\))+?\s*\}\}/i, "namespace.json"],
        [/\{/, "delimiter.bracket.json"],
        [/\}/, "delimiter.bracket.json"],
        [/\[/, "delimiter.array.json"],
        [/\]/, "delimiter.array.json"],
        [/,/, "delimiter.comma.json"],
        [/:/, "delimiter.colon.json"],
        // Same key regex as Monaco's JSON monarch / common samples.
        [/"([^"\\]|\\.)*"(?=\s*:)/, "string.key.json"],
        [/"([^"\\]|\\.)*"/, "string.value.json"],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number.json"],
        [/\b(?:true|false|null)\b/, "keyword.json"],
      ],
    },
  });
}

let xmlHighlightPatched = false;
/** Color XML element/CDATA text as string (orange), matching JSON/YAML values. */
function patchXmlValueHighlighting(monaco: any) {
  if (xmlHighlightPatched) {
    return;
  }
  xmlHighlightPatched = true;
  // Built-in XML leaves text as "" (default/white). Retokenize as string.xml.
  monaco.languages.setMonarchTokensProvider("xml", {
    defaultToken: "",
    tokenPostfix: ".xml",
    ignoreCase: true,
    qualifiedName: /(?:[\w.-]+:)?[\w.-]+/,
    tokenizer: {
      root: [
        [/[^<&]+/, "string"],
        { include: "@whitespace" },
        [/(<)(@qualifiedName)/, [{ token: "delimiter" }, { token: "tag", next: "@tag" }]],
        [
          /(<\/)(@qualifiedName)(\s*)(>)/,
          [{ token: "delimiter" }, { token: "tag" }, "", { token: "delimiter" }],
        ],
        [/(<\?)(@qualifiedName)/, [{ token: "delimiter" }, { token: "metatag", next: "@tag" }]],
        [/(<!)(@qualifiedName)/, [{ token: "delimiter" }, { token: "metatag", next: "@tag" }]],
        [/<!\[CDATA\[/, { token: "delimiter.cdata", next: "@cdata" }],
        [/&\w+;/, "string.escape"],
      ],
      cdata: [
        [/[^\]]+/, "string"],
        [/\]\]>/, { token: "delimiter.cdata", next: "@pop" }],
        [/\]/, "string"],
      ],
      tag: [
        [/[ \t\r\n]+/, ""],
        [/(@qualifiedName)(\s*=\s*)("[^"]*"|'[^']*')/, ["attribute.name", "", "attribute.value"]],
        [
          /(@qualifiedName)(\s*=\s*)("[^">?/]*|'[^'>?/]*)(?=[?/]>)/,
          ["attribute.name", "", "attribute.value"],
        ],
        [/(@qualifiedName)(\s*=\s*)("[^">]*|'[^'>]*)/, ["attribute.name", "", "attribute.value"]],
        [/@qualifiedName/, "attribute.name"],
        [/\?>/, { token: "delimiter", next: "@pop" }],
        [/(\/)(>)/, [{ token: "tag" }, { token: "delimiter", next: "@pop" }]],
        [/>/, { token: "delimiter", next: "@pop" }],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/<!--/, { token: "comment", next: "@comment" }],
      ],
      comment: [
        [/[^<-]+/, "comment.content"],
        [/-->/, { token: "comment", next: "@pop" }],
        [/<!--/, "comment.content.invalid"],
        [/[<-]/, "comment.content"],
      ],
    },
  });
}

function clampMonacoPosition(model: any, pos: { lineNumber: number; column: number }) {
  if (!model || !pos) {
    return pos;
  }
  const lineCount = model.getLineCount();
  const lineNumber = Math.min(Math.max(1, pos.lineNumber), lineCount);
  const column = Math.min(Math.max(1, pos.column), model.getLineMaxColumn(lineNumber));
  return { lineNumber, column };
}

const TextEditor: React.FC<TextEditorProps> = ({
  content,
  setContent,
  language = "yaml",
  showNumbers = true,
  fontSize = 12,
  beforeMount,
  editorRef,
  monacoRef,
  setEditorReady,
  onFocusChange,
  onInspectPosition,
  onToggleRunButton,
  onPasteTextTransform,
  rewriteTypedValue,
  showGlyphMargin = false,
  readOnly = false,
  enableContextMenu = true,
}) => {
  const localMonacoRef = useRef<any>(null);
  const localEditorRef = useRef<any>(null);
  const applyingPasteTransformRef = useRef(false);
  const applyingExternalContentRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;

  // Use passed refs if provided, else fallback to local refs
  const monacoRefToUse = monacoRef || localMonacoRef;
  const editorRefToUse = editorRef || localEditorRef;

  const toggleRunButtonRef = useRef(onToggleRunButton);
  useEffect(() => {
    toggleRunButtonRef.current = onToggleRunButton;
  }, [onToggleRunButton]);

  const inspectPositionRef = useRef(onInspectPosition);
  useEffect(() => {
    inspectPositionRef.current = onInspectPosition;
  }, [onInspectPosition]);

  const pasteTextTransformRef = useRef(onPasteTextTransform);
  useEffect(() => {
    pasteTextTransformRef.current = onPasteTextTransform;
  }, [onPasteTextTransform]);

  const rewriteTypedValueRef = useRef(rewriteTypedValue);
  useEffect(() => {
    rewriteTypedValueRef.current = rewriteTypedValue;
  }, [rewriteTypedValue]);
  /** Caret offset in the rewritten buffer (`{{i:x|}}`, before `}}`). */
  const pendingTypedCaretRef = useRef<number | null>(null);

  // Keep Monaco React theme prop in sync with flip-flop theme names from Theme.tsx.
  const [monacoTheme, setMonacoTheme] = useState(getMonacoThemeName);
  useEffect(() => {
    const handler = (event: Event) => {
      const name = (event as CustomEvent).detail?.monacoTheme || getMonacoThemeName();
      setMonacoTheme(name);
      if (monacoRefToUse.current) {
        monacoRefToUse.current.editor.setTheme(name);
      }
    };
    window.addEventListener("vscode:changeColorTheme", handler as EventListener);
    return () => window.removeEventListener("vscode:changeColorTheme", handler as EventListener);
  }, [monacoRefToUse]);

  // Add CSS for dynamic token highlights (e:/i:/r:/c: and ${...}).
  // Use a theme foreground color — not a selection-like background fill.
  useEffect(() => {
    let style = document.getElementById("i-prefix-highlight-style") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "i-prefix-highlight-style";
      document.head.appendChild(style);
    }
    style.innerHTML = `
      .${I_PREFIX_CLASS} {
        color: var(--mmt-token-variable, var(--mmt-token-anchor, #4ec9b0)) !important;
        background: transparent !important;
        font-weight: 600;
      }
    `;
  }, []);

  useEffect(() => {
    if (document.getElementById("mmt-yaml-constant-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-yaml-constant-style";
    style.innerHTML = `
      .${YAML_CONSTANT_CLASS} {
        color: var(--mmt-yaml-constant-color, #569cd6) !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for expect operator highlights (red colour matching YAML tag token)
  useEffect(() => {
    if (document.getElementById("mmt-expect-operator-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-expect-operator-style";
    style.innerHTML = `
      .mmt-expect-operator {
        color: var(--mmt-expect-op-color, #F07178) !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for link underline used by YamlEditorPanel
  useEffect(() => {
    if (document.getElementById("mmt-link-underline-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-link-underline-style";
    style.innerHTML = `
      .mmt-link-underline {
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for yellow underline on undefined inputs passed to imported items
  useEffect(() => {
    if (document.getElementById("mmt-undefined-input-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-undefined-input-style";
    style.innerHTML = `
      .mmt-undefined-input-underline {
        text-decoration: underline wavy;
        text-decoration-color: #e2c358;
        text-underline-offset: 3px;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (document.getElementById("mmt-deprecated-keyword-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "mmt-deprecated-keyword-style";
    style.innerHTML = `
      .mmt-deprecated-keyword {
        text-decoration: line-through;
        text-decoration-color: var(--vscode-editorWarning-foreground, #cca700);
        text-decoration-thickness: 1px;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Add CSS for run glyph rendered in the gutter
  useEffect(() => {
    if (document.getElementById("mmt-run-glyph-style")) return;
    const style = document.createElement("style");
    style.id = "mmt-run-glyph-style";
    style.innerHTML = `
      .mmt-run-glyph {
        color: var(--vscode-testing-iconPassed, #3fb950);
        cursor: pointer;
        font-family: "codicon";
        font-size: 16px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Body {{random …}} / {{current …}}: one foreground color + soft glass fill
  // (same glass as the old e:/i: highlight — not wordHighlightStrong).
  useEffect(() => {
    let style = document.getElementById("mmt-body-runtime-token-style") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "mmt-body-runtime-token-style";
      document.head.appendChild(style);
    }
    style.innerHTML = `
      .monaco-editor .mmt-body-runtime-token {
        color: var(--mmt-token-variable, var(--mmt-token-anchor, #4ec9b0)) !important;
        background: color-mix(in srgb, var(--vscode-editorInfo-foreground, #75beff) 28%, transparent);
        border-radius: 2px;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    `;
  }, []);

  // Red dot after resolved r:/c: body values (legacy; URL/KSV still use .mmt-runtime-dot)
  useEffect(() => {
    if (document.getElementById("mmt-runtime-value-dot-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "mmt-runtime-value-dot-style";
    style.innerHTML = `
      .monaco-editor .mmt-runtime-value-dot::after {
        content: "";
        display: inline-block;
        width: 5px;
        height: 5px;
        margin-left: 3px;
        border-radius: 50%;
        background: var(--vscode-errorForeground, #f14c4c);
        vertical-align: text-top;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  /**
   * Apply parent `content` without Monaco React's controlled `value` sync.
   * That path uses executeEdits(..., forceMoveMarkers: true) on the full range,
   * which jumps the cursor to EOF on every external rewrite (save echo, CRLF→LF
   * body normalize, UI→YAML pack).
   *
   * The first hydration uses setValue so Ctrl+Z cannot rewind to the empty
   * buffer the editor mounts with. Later rewrites are pushed as undoable edits
   * over the changed range only, which keeps the file's undo history alive.
   */
  const applyExternalContent = (editor: any, next: string) => {
    const model = editor.getModel?.();
    if (!model) {
      return;
    }
    const placePendingCaret = () => {
      const pending = pendingTypedCaretRef.current;
      const liveModel = editor.getModel?.();
      if (pending == null || !liveModel || editor.getValue() !== next) {
        return;
      }
      pendingTypedCaretRef.current = null;
      if (typeof liveModel.getPositionAt !== "function") {
        return;
      }
      const caret = liveModel.getPositionAt(Math.max(0, Math.min(pending, next.length)));
      editor.setPosition?.(caret);
    };
    const current = editor.getValue();
    const plan = planExternalMonacoApply(current, next);
    if (plan === "noop") {
      placePendingCaret();
      return;
    }
    const scrollTop = editor.getScrollTop?.() ?? 0;
    const scrollLeft = editor.getScrollLeft?.() ?? 0;
    applyingExternalContentRef.current = true;
    applyingPasteTransformRef.current = true;
    try {
      if (plan === "setValue") {
        editor.setValue(next);
      } else {
        pushExternalEdit(editor, model, current, next);
      }
      editor.setScrollTop?.(scrollTop);
      editor.setScrollLeft?.(scrollLeft);
      placePendingCaret();
    } finally {
      // Monaco may notify listeners asynchronously; keep suppress flags until
      // after the current turn so onChange cannot echo the sync as a user edit.
      queueMicrotask(() => {
        applyingExternalContentRef.current = false;
        applyingPasteTransformRef.current = false;
      });
    }
  };

  /**
   * Replace only the changed range and keep it on the undo stack, so the user
   * can undo a UI-driven YAML rewrite and everything typed before it.
   */
  const pushExternalEdit = (editor: any, model: any, current: string, next: string) => {
    const span = computeMinimalEditSpan(current, next);
    if (!span) {
      return;
    }
    const start = model.getPositionAt(span.start);
    const end = model.getPositionAt(span.end);
    const selections = editor.getSelections?.() ?? null;
    model.pushStackElement?.();
    model.pushEditOperations?.(
      selections,
      [
        {
          range: {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          },
          text: span.text,
          forceMoveMarkers: false,
        },
      ],
      // Keep the cursor where Monaco moved it for this edit instead of forcing
      // it to the end of the replaced range.
      () => null,
    );
    model.pushStackElement?.();
    const position = editor.getPosition?.();
    if (position) {
      editor.setPosition?.(clampMonacoPosition(model, position));
    }
  };

  useEffect(() => {
    const editor = editorRefToUse.current;
    if (!editor) {
      return;
    }
    applyExternalContent(editor, content);
    // Re-run only when content changes; helpers are recreated each render but
    // are always current when this effect runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editorRefToUse]);

  const editorDidMount = (editor: any) => {
    editorRefToUse.current = editor;
    // defaultValue may be stale if content arrived before mount finished.
    // setValue (not executeEdits) so undo cannot rewind to the empty default.
    if (contentRef.current !== editor.getValue()) {
      applyingExternalContentRef.current = true;
      applyingPasteTransformRef.current = true;
      try {
        editor.setValue(contentRef.current);
      } finally {
        queueMicrotask(() => {
          applyingExternalContentRef.current = false;
          applyingPasteTransformRef.current = false;
        });
      }
    }
    editor.onDidFocusEditorWidget?.(() => {
      if (typeof onFocusChange === "function") onFocusChange(true);
    });
    editor.onDidBlurEditorWidget?.(() => {
      if (typeof onFocusChange === "function") onFocusChange(false);
    });
    // Add simple context menu action to log current cursor position
    if (onInspectPosition) {
      editor.addAction({
        id: "mmt.AddAsOutputVariable",
        label: "Add As Output Variable",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 99,
        run: () => {
          const pos = editor.getPosition();
          if (!pos) {
            return;
          }
          const text = editor.getValue();
          inspectPositionRef.current?.({
            line: pos.lineNumber,
            column: pos.column,
            text,
          });
        },
      });
    }
    if (onToggleRunButton) {
      editor.addAction({
        id: "mmt.RunAPI",
        label: "Run API",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 98,
        run: () => {
          toggleRunButtonRef.current?.();
        },
      });
    }
    editor.onDidChangeModelContent?.((event: any) => {
      if (applyingPasteTransformRef.current || applyingExternalContentRef.current) {
        return;
      }
      const transformer = pasteTextTransformRef.current;
      const model = editor.getModel?.();
      const monaco = monacoRefToUse.current;
      if (!transformer || !model || !monaco?.Range || !Array.isArray(event?.changes)) {
        return;
      }
      const edits = event.changes
          .map((change: any) => {
            const raw = typeof change.text === 'string' ? change.text : '';
            const transformed = raw ? transformer(raw) : null;
            if (transformed === null || transformed === undefined || transformed === raw) {
              return null;
            }
            const start = model.getPositionAt(change.rangeOffset);
            const end = model.getPositionAt(change.rangeOffset + raw.length);
            return {
              range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
              text: transformed,
              forceMoveMarkers: true,
            };
          })
          .filter(Boolean);
      if (edits.length === 0) {
        return;
      }
      applyingPasteTransformRef.current = true;
      try {
        editor.executeEdits('mmt-paste-transform', edits);
      } finally {
        applyingPasteTransformRef.current = false;
      }
    });
    // Mark editor as ready for consumers like YamlEditorPanel effects
    setEditorReady?.(true);
  };

  return (
    <MonacoEditor
      height="100%"
      width="100%"
      language={language}
      defaultValue={content}
      theme={monacoTheme}
      beforeMount={monaco => {
        monacoRefToUse.current = monaco;
        defineTheme(monaco);
        registerGraphQLLanguage(monaco);
        registerUrlEncodedLanguage(monaco);
        registerMmtJsonLanguage(monaco);
        patchXmlValueHighlighting(monaco);
        beforeMount?.(monaco);
      }}
      onMount={editorDidMount}
      onChange={value => {
        if (applyingExternalContentRef.current) {
          return;
        }
        const raw = value ?? "";
        const rewriter = rewriteTypedValueRef.current;
        const editor = editorRefToUse.current;
        const model = editor?.getModel?.();
        const pos = editor?.getPosition?.();
        if (
          rewriter &&
          model &&
          pos &&
          typeof model.getOffsetAt === "function" &&
          typeof model.getPositionAt === "function"
        ) {
          const wrapped = rewriter(raw, model.getOffsetAt(pos));
          if (wrapped.text !== raw) {
            pendingTypedCaretRef.current = wrapped.cursor;
            const span = computeMinimalEditSpan(raw, wrapped.text);
            applyingExternalContentRef.current = true;
            applyingPasteTransformRef.current = true;
            try {
              if (span && typeof editor.executeEdits === "function") {
                const start = model.getPositionAt(span.start);
                const end = model.getPositionAt(span.end);
                editor.executeEdits("mmt-token-wrap", [{
                  range: {
                    startLineNumber: start.lineNumber,
                    startColumn: start.column,
                    endLineNumber: end.lineNumber,
                    endColumn: end.column,
                  },
                  text: span.text,
                  forceMoveMarkers: false,
                }]);
              }
              const caret = model.getPositionAt(
                Math.max(0, Math.min(wrapped.cursor, wrapped.text.length)),
              );
              editor.setPosition?.(caret);
            } finally {
              queueMicrotask(() => {
                applyingExternalContentRef.current = false;
                applyingPasteTransformRef.current = false;
              });
            }
            setContent(wrapped.text);
            return;
          }
        }
        setContent(raw);
      }}
      options={{
        fontSize,
        minimap: { enabled: false },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        lineNumbers: showNumbers ? "on" : "off",
        glyphMargin: showGlyphMargin,
        readOnly,
        domReadOnly: readOnly,
        contextmenu: enableContextMenu,
        lineDecorationsWidth: 0,
        scrollbar: {
          horizontal: "auto",
          vertical: "auto"
        }
      }}
    />
  );
};

export default TextEditor;