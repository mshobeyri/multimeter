import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { SplitPane } from "@rexxars/react-split-pane";
import { extractInputConstraintsFromDescription } from "mmt-core/paramConstraints";
import { APIData, exampleExpect, exampleId, exampleTitle } from "mmt-core/APIData";
import { JSONRecord, Method, Protocol, RequestFormat, ResponseFormat, requestFormat, responseFormat } from "mmt-core/CommonData";
import { resolveRequestFormat } from "mmt-core/formatResolve";
import KSVEditor from "../components/KSVEditor";
import BodyView, { type BodyViewCursor } from "../components/BodyView";
import FilePickerInput from "../components/FilePickerInput";
import MultipartPartsEditor from "../components/MultipartPartsEditor";
import {
  displayRequestBody,
  packBodyAsYamlEncoded,
  peerRecordToDisplay,
  peerRecordToYaml,
  peerStringToDisplay,
  peerStringToYaml,
  tokensTextToYamlBody,
  valueForYamlSave,
  yamlBodyToTokensText,
} from "mmt-core/apiBodyEdit";
import { normalizeNewlines } from "mmt-core/textLines";
import { applyFormatSideEdit } from "mmt-core/apiFormatEdit";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { HideWhenYamlError } from "./YamlErrorWarning";
import MethodUrlBar from "../components/MethodUrlBar";
import BlurCommitInput from "../components/BlurCommitInput";
import BodyFormatBar from "../components/BodyFormatBar";
import ResponseBodyBar from "../components/ResponseBodyBar";
import ResponseBodyContent from "../components/ResponseBodyContent";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";
import VEditor from "../components/VEditor";
import { FileContext } from "../fileContext";
import { showHistoryPanel } from "../vsAPI";
import { useAPITesterLogic } from "./useAPITesterLogic";
import {
  resolveResponseDisplayState,
  type ResponseViewMode,
} from "./responseBodyDisplay";
import { protocolResolver } from "mmt-core";
import { resolveApiHttpMethod } from "mmt-core/apiMethod";
import MdViewer from "../components/MdViewer";
import DescriptionEditor from "../components/DescriptionEditor";
import SearchableTagInput from "../components/SearchableTagInput";
import SectionEditLabel, { SectionEditDone } from "../components/SectionEditLabel";
import FadePane from "../components/FadePane";
import KVEditor from "../components/KVEditor";
import { safeList } from "mmt-core/safer";
import ApiTestsEditor from "./ApiTestsEditor";
import ApiSettingsEditor from "./ApiSettingsEditor";
import ApiAuthEditor from "./ApiAuthEditor";
import { formatBody } from "mmt-core/markupConvertor";
import { FormatChip } from "../components/BodyFormatControls";
import OverflowTabBar, { type OverflowTabItem } from "../components/OverflowTabBar";
import {
  accentChromeCssVars,
  accentChromeFor,
} from "../shared/themeAccent";
import { findMatchingExampleIndex } from "./apiExampleMatch";
import { SELECT_EXAMPLE_EVENT } from "../text/exampleSelect";

/** Body pane: resolved values vs editable {{…}} tokens. */
type BodyTokenMode = "resolved" | "tokens";

function isStructuredYamlBody(body: unknown): boolean {
  return body != null && body !== "" && typeof body === "object";
}

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  onRequestReset?: (reset: () => void) => void;
  rightOfUrlButton?: React.ReactNode;
  selector?: React.ReactNode;
  initialExampleIndex?: number;
}

type EditorTab =
  | "settings"
  | "auth"
  | "body"
  | "params"
  | "headers"
  | "cookies"
  | "doc"
  | "graphql"
  | "grpc"
  | "inputs";

type ResponseTab = "body" | "headers" | "cookies" | "outputs";

function countNamedEntries(record?: Record<string, unknown> | null): number {
  if (!record) {
    return 0;
  }
  return Object.keys(record).filter(key => key.trim().length > 0).length;
}

/** Empty state for response tabs before the first Send. */
const NoResponseYet: React.FC<{ onSend: () => void }> = ({ onSend }) => (
  <div className="apitest-body-none apitest-no-response" role="status">
    <span className="codicon codicon-send apitest-body-none-icon" aria-hidden />
    <div className="apitest-body-none-message">
      <div className="apitest-body-none-title">No response yet.</div>
      <div className="apitest-body-none-hint">
        Click{" "}
        <button
          type="button"
          className="apitest-empty-send-link"
          onClick={onSend}
        >
          Send
        </button>
        {" "}to run the request.
      </div>
    </div>
  </div>
);

const TAB_OPTIONS: Array<{
  key: EditorTab;
  label: string;
  protocol?: string;
  /** When set, tab shows only this codicon (no text label). */
  iconOnly?: string;
}> = [
  { key: "auth", label: "Auth" },
  { key: "graphql", label: "GraphQL", protocol: "graphql" },
  { key: "grpc", label: "gRPC", protocol: "grpc" },
  { key: "params", label: "Params" },
  { key: "headers", label: "Headers" },
  { key: "body", label: "Body" },
  { key: "cookies", label: "Cookies" },
  { key: "inputs", label: "Inputs" },
  { key: "doc", label: "Doc" },
  { key: "settings", label: "Settings", iconOnly: "settings-gear" },
];

const RESPONSE_TAB_OPTIONS: Array<{ key: ResponseTab; label: string }> = [
  { key: "body", label: "Body" },
  { key: "headers", label: "Headers" },
  { key: "cookies", label: "Cookies" },
  { key: "outputs", label: "Outputs" },
];

const REQUEST_PANE_RATIO_KEY = "apitest-request-pane-ratio";
const RESPONSE_TAB_KEY = "apitest-response-tab";
const BODY_TOKEN_MODE_KEY = "apitest-body-token-mode";
const DEFAULT_REQUEST_PANE_RATIO = 0.5;
const MIN_REQUEST_PANE_RATIO = 0.15;
const MAX_REQUEST_PANE_RATIO = 0.85;

function cloneInputs(source?: JSONRecord): JSONRecord {
  if (!source) {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch {
    return { ...source };
  }
}

const APITest: React.FC<APITestProps> = ({ api, onUpdateApi, onRequestReset, rightOfUrlButton, selector, initialExampleIndex }) => {
  const { mmtFilePath } = useContext(FileContext);
  const {
    requestData,
    responseData,
    responseRevision,
    selectedExampleIdx,
    setSelectedExampleIdx,
    currentInputs,
    setCurrentInputs,
    envValues,
    autoFormatBody,
    outputs,
    setenvValues,
    apiTestResults,
    handleAddOutputVariable,
    prepareRequestData,
    handleSend,
    handleRunInCore,
    handleCancel,
    clearResponse,
    handleConnect,
    network,
    examples,
    isSending,
  } = useAPITesterLogic({ api, onUpdateApi, filePath: mmtFilePath, initialExampleIndex });

  const bodyValueContext = useMemo(
    () => ({ inputs: currentInputs, env: envValues }),
    [currentInputs, envValues],
  );

  const [bodyTokenMode, setBodyTokenMode] = useState<BodyTokenMode>(() => {
    const saved = localStorage.getItem(BODY_TOKEN_MODE_KEY);
    if (saved === "resolved" || saved === "tokens") {
      return saved;
    }
    return "tokens";
  });

  useEffect(() => {
    onRequestReset?.(() => {
      setBodyYamlEncodedManual(isStructuredYamlBody(api.body));
      setBodyYamlEncodeError(false);
      const baseInputs = selectedExampleIdx === -1
        ? (api.inputs || {})
        : (examples[selectedExampleIdx]?.inputs || {});
      const nextInputs = cloneInputs(baseInputs);
      setCurrentInputs(nextInputs);
      prepareRequestData(nextInputs, { forceReset: true, scopes: ["all"] });
    });
  }, [onRequestReset, prepareRequestData, api, examples, selectedExampleIdx, setCurrentInputs]);

  useEffect(() => {
    // Seed storage preference from the newly opened file only.
    setBodyYamlEncodedManual(isStructuredYamlBody(api.body));
    setBodyYamlEncodeError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on file switch
  }, [mmtFilePath]);

  useEffect(() => {
    localStorage.setItem(BODY_TOKEN_MODE_KEY, bodyTokenMode);
  }, [bodyTokenMode]);

  // Based on the displayed URL (not resolved inputs/env)
  const isDisplayedUrlWebSocket = (protocol: Protocol | undefined, url: string | undefined
  ): boolean => {
    return protocolResolver.getEffectiveProtocol(protocol, url) === "ws";
  };

  // Peer fields read from YAML (`api`); requestData is for Send resolution / body preview.
  const isGraphQL = (requestData?.protocol ?? api.protocol) === "graphql";
  const isGrpc = (requestData?.protocol ?? api.protocol) === "grpc";
  const requestProtocol = requestData?.protocol || api.protocol;
  const peerUrl = useMemo(() => peerStringToDisplay(api.url), [api.url]);
  const peerQuery = useMemo(
    () => peerRecordToDisplay(api.query as Record<string, unknown> | undefined),
    [api.query],
  );
  const peerHeaders = useMemo(
    () => peerRecordToDisplay(api.headers as Record<string, unknown> | undefined),
    [api.headers],
  );
  const peerCookies = useMemo(
    () => peerRecordToDisplay(api.cookies as Record<string, unknown> | undefined),
    [api.cookies],
  );
  const peerGraphqlVariables = useMemo(
    () => peerRecordToDisplay(
      api.graphql?.variables as Record<string, unknown> | undefined,
    ),
    [api.graphql?.variables],
  );
  const peerGrpcMessage = useMemo(
    () => peerRecordToDisplay(
      api.grpc?.message as Record<string, unknown> | undefined,
    ),
    [api.grpc?.message],
  );
  const peerGraphqlOperation = useMemo(
    () => peerStringToDisplay(api.graphql?.operation),
    [api.graphql?.operation],
  );
  /** Declared output keys (Examples pane); values keep runtime types for VEditor. */
  const outputKeys = useMemo(
    () => Object.keys(api.outputs && typeof api.outputs === "object" ? api.outputs : {}),
    [api.outputs],
  );
  const outputDisplay = useMemo((): JSONRecord => {
    const out: JSONRecord = {};
    for (const key of outputKeys) {
      if (Object.prototype.hasOwnProperty.call(outputs, key)) {
        out[key] = outputs[key];
      }
    }
    return out;
  }, [outputKeys, outputs]);
  const outputFieldSuggestions = outputKeys;

  /** Declared setenv env names; view mode shows values written after Send. */
  const setenvKeys = useMemo(
    () => Object.keys(api.setenv && typeof api.setenv === "object" ? api.setenv : {})
      .filter(key => key.trim().length > 0),
    [api.setenv],
  );
  const setenvDisplay = useMemo((): JSONRecord => {
    const out: JSONRecord = {};
    for (const key of setenvKeys) {
      if (Object.prototype.hasOwnProperty.call(setenvValues, key)) {
        out[key] = setenvValues[key];
      }
    }
    return out;
  }, [setenvKeys, setenvValues]);

  /** Per declared output: pass/fail vs selected example expect after Send. */
  const outputMatchStatus = useMemo(() => {
    const map = new Map<string, "match" | "mismatch">();
    if (!apiTestResults?.length || outputKeys.length === 0) {
      return map;
    }
    const keySet = new Set(outputKeys);
    for (const item of apiTestResults) {
      if (item.level !== "expect") {
        continue;
      }
      const field = String(item.comparison || "").split(/\s+/)[0];
      if (!field || !keySet.has(field)) {
        continue;
      }
      if (item.status === "failed") {
        map.set(field, "mismatch");
      } else if (item.status === "passed" && map.get(field) !== "mismatch") {
        map.set(field, "match");
      }
    }
    return map;
  }, [apiTestResults, outputKeys]);

  const effectiveProtocol = protocolResolver.getEffectiveProtocol(
    requestData?.protocol || api.protocol,
    api.url,
  );
  const methodOrProtocolValue = (effectiveProtocol === "ws" || effectiveProtocol === "graphql" || effectiveProtocol === "grpc")
    ? `protocol:${effectiveProtocol}`
    : `method:${resolveApiHttpMethod(
        requestData?.method || api.method,
        requestData?.body ?? api.body).toLowerCase()}`;
  const methodOrProtocolKey = methodOrProtocolValue.startsWith("protocol:")
    ? methodOrProtocolValue.slice("protocol:".length)
    : methodOrProtocolValue.slice("method:".length);
  const currentRequestFormat = requestFormat(api.format);
  const currentResponseFormat = responseFormat(api.format);
  const resolvedRequestFormat = resolveRequestFormat(
    currentRequestFormat,
    api.headers as Record<string, string> | undefined,
    methodOrProtocolValue.startsWith("method:") ? methodOrProtocolKey : undefined,
  );
  // Resolved preview shows substituted i:/e:/r:/c: values. Token mode uses a
  // separate BodyView with {{…}} markers (own Ctrl+Z stack).
  const requestBodyDisplay = useMemo(() => {
    return displayRequestBody(
      requestData?.body ?? api.body ?? "",
      resolvedRequestFormat,
      { valueContext: bodyValueContext },
    );
  }, [
    requestData?.body,
    api.body,
    resolvedRequestFormat,
    bodyValueContext,
  ]);

  const onUrlChange = useCallback((newUrl: string) => {
    onUpdateApi?.({ url: peerStringToYaml(newUrl) });
  }, [onUpdateApi]);

  const onQueryChange = useCallback((query: Record<string, string>) => {
    onUpdateApi?.({ query: peerRecordToYaml(query) });
  }, [onUpdateApi]);

  const onHeadersChange = useCallback((headers: Record<string, string>) => {
    onUpdateApi?.({ headers: peerRecordToYaml(headers) });
  }, [onUpdateApi]);

  const onCookiesChange = useCallback((cookies: Record<string, string>) => {
    onUpdateApi?.({ cookies: peerRecordToYaml(cookies) });
  }, [onUpdateApi]);

  const [responseViewMode, setResponseViewModeState] = useState<ResponseViewMode>(() => {
    const saved = localStorage.getItem("apitest-response-view-mode");
    if (saved === "raw" || saved === "pretty" || saved === "preview") {
      return saved;
    }
    return autoFormatBody ? "pretty" : "raw";
  });
  const responseDisplay = useMemo(
    () => resolveResponseDisplayState(responseData, {
      type: currentResponseFormat,
      view: responseViewMode,
      requestFormat: currentRequestFormat,
      requestHeaders: requestData?.headers,
    }),
    [
      responseData,
      currentResponseFormat,
      responseViewMode,
      currentRequestFormat,
      requestData?.headers,
    ],
  );
  const setResponseViewMode = (view: ResponseViewMode) => {
    setResponseViewModeState(view);
    localStorage.setItem("apitest-response-view-mode", view);
  };
  // Body is disabled only when the resolved format is `none` (e.g. auto+GET).
  // An explicit format (raw/json/…) keeps the body editable and sendable on GET.
  const requestBodyDisabled = !isGraphQL && !isGrpc && effectiveProtocol !== "ws" &&
    resolvedRequestFormat === "none";
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener("vscode:changeColorTheme", onTheme as EventListener);
    return () => window.removeEventListener("vscode:changeColorTheme", onTheme as EventListener);
  }, []);
  const methodChrome = useMemo(
    () => accentChromeFor(methodOrProtocolKey),
    // themeTick forces recompute when VS Code theme CSS vars change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [methodOrProtocolKey, themeTick],
  );
  const methodChromeVars = accentChromeCssVars(methodChrome);
  const methodOrProtocolAccent = methodChrome.accent;

  const canRunCurl = requestProtocol !== "graphql" && requestProtocol !== "grpc" &&
    !isDisplayedUrlWebSocket(requestData?.protocol || api.protocol, api.url);
  const runInputs = useMemo(() => ({
    exampleIndex: selectedExampleIdx,
    manualInputs: currentInputs
  }), [currentInputs, selectedExampleIdx]);

  const [editorTab, setEditorTabInternal] = useState<EditorTab>(() => {
    const saved = localStorage.getItem("apitest-editor-tab");
    // Legacy combined In/Out / Examples / tests → Inputs (request side).
    if (saved === "examples" || saved === "tests" || saved === "inout") {
      return "inputs";
    }
    if (
      saved === "settings" ||
      saved === "auth" ||
      saved === "body" ||
      saved === "params" ||
      saved === "headers" ||
      saved === "cookies" ||
      saved === "doc" ||
      saved === "graphql" ||
      saved === "grpc" ||
      saved === "inputs"
    ) {
      return saved;
    }
    if (api.protocol === "graphql") {
      return "graphql";
    }
    if (api.protocol === "grpc") {
      return "grpc";
    }
    return "body";
  });

  const [responseTab, setResponseTabInternal] = useState<ResponseTab>(() => {
    const saved = localStorage.getItem(RESPONSE_TAB_KEY);
    // Legacy combined response In/Out tab → Outputs.
    if (saved === "inout") {
      return "outputs";
    }
    if (saved === "body" || saved === "headers" || saved === "cookies" || saved === "outputs") {
      return saved;
    }
    return "body";
  });

  const contentRef = useRef<HTMLDivElement | null>(null);
  const requestPaneRatioRef = useRef(DEFAULT_REQUEST_PANE_RATIO);
  const [requestPaneSize, setRequestPaneSize] = useState(200);

  useEffect(() => {
    const saved = Number(localStorage.getItem(REQUEST_PANE_RATIO_KEY));
    if (Number.isFinite(saved) && saved >= MIN_REQUEST_PANE_RATIO && saved <= MAX_REQUEST_PANE_RATIO) {
      requestPaneRatioRef.current = saved;
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const syncFromRatio = () => {
      const height = el.clientHeight;
      if (height <= 0) {
        return;
      }
      setRequestPaneSize(Math.floor(height * requestPaneRatioRef.current));
    };
    syncFromRatio();
    const observer = new ResizeObserver(syncFromRatio);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [editTitle, setEditTitle] = useState(false);
  const [editTags, setEditTags] = useState(false);
  const [editDescription, setEditDescription] = useState(false);
  const [editInputsDecl, setEditInputsDecl] = useState(false);
  const [editOutputsDecl, setEditOutputsDecl] = useState(false);
  const [editSetenvDecl, setEditSetenvDecl] = useState(false);

  const setEditorTab = (tab: EditorTab) => {
    setEditorTabInternal(tab);
    localStorage.setItem("apitest-editor-tab", tab);
  };

  const setResponseTab = (tab: ResponseTab) => {
    setResponseTabInternal(tab);
    localStorage.setItem(RESPONSE_TAB_KEY, tab);
  };

  const handleRequestPaneResize = (size: number) => {
    const height = contentRef.current?.clientHeight ?? 0;
    if (height > 0) {
      const ratio = Math.min(
        MAX_REQUEST_PANE_RATIO,
        Math.max(MIN_REQUEST_PANE_RATIO, size / height),
      );
      requestPaneRatioRef.current = ratio;
      localStorage.setItem(REQUEST_PANE_RATIO_KEY, String(ratio));
    }
    setRequestPaneSize(size);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if ((data?.command === "multimeter.coachArrow" || data?.type === "coachArrow") &&
          data.target === "body") {
        setEditorTab("body");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleMethodOrProtocolChange = (raw: string) => {
    if (raw.startsWith("protocol:")) {
      const protocol = raw.slice("protocol:".length) as Protocol;
      onUpdateApi?.({ protocol });
      if (protocol === "graphql" || protocol === "grpc") {
        setEditorTab(protocol);
      } else if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
      return;
    }
    if (raw.startsWith("method:")) {
      const method = raw.slice("method:".length) as Method;
      onUpdateApi?.({ method, protocol: "http" });
      if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
    }
  };

  const shouldShowQuery = () => editorTab === "params";
  const shouldShowHeaders = () => editorTab === "headers";
  const shouldShowCookies = () => editorTab === "cookies";
  const shouldShowBody = () => editorTab === "body";
  const shouldShowInputs = () => editorTab === "inputs";
  const shouldShowOutputs = () => responseTab === "outputs";
  const shouldShowResponse = () => responseTab === "body";
  const shouldShowResponseHeaders = () => responseTab === "headers";
  const shouldShowResponseCookies = () => responseTab === "cookies";
  const shouldShowDoc = () => editorTab === "doc";
  const shouldShowSettings = () => editorTab === "settings";
  const shouldShowAuth = () => editorTab === "auth";
  const shouldShowGraphql = () => editorTab === "graphql";
  const shouldShowGrpc = () => editorTab === "grpc";
  const isWsUrl = isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url);
  const setBodyFormat = (side: "request" | "response", format: RequestFormat | ResponseFormat) => {
    // Format chips write straight to YAML. applyFormatSideEdit keeps
    // request/response independent and collapses back to the YAML shape when
    // both sides match the baseline again.
    const result = applyFormatSideEdit({
      side,
      value: format,
      yamlFormat: api.format,
      currentFormat: api.format,
      formatTouched: false,
    });
    onUpdateApi?.({ format: result.format });
    // text bodies are always plain storage.
    if (side === "request" && format === "text" && isStructuredYamlBody(api.body)) {
      const asText = formatBody("text", api.body ?? "");
      setBodyYamlEncodedManual(false);
      setBodyYamlEncodeError(false);
      onUpdateApi?.({ body: valueForYamlSave(asText) as APIData["body"] });
    }
  };

  // Resolved preview vs token editor. Mode only leaves tokens via the chip (no blur exit).
  // Two independent axes:
  //   storage: plain | encoded  → shape of api.body in YAML
  //   view:    resolved | tokens → what BodyView shows
  // Tokens draft peers YAML on every keystroke (no debounce).
  const [bodyEditDraft, setBodyEditDraft] = useState("");
  const [bodyEditSession, setBodyEditSession] = useState(0);
  const [bodyEditCursor, setBodyEditCursor] = useState<BodyViewCursor | undefined>();
  const [bodyYamlEncodeError, setBodyYamlEncodeError] = useState(false);
  // Manual preference: retry encode on each keystroke while true.
  const [bodyYamlEncodedManual, setBodyYamlEncodedManual] = useState(true);
  const skipBodySyncRef = useRef(false);
  const resolvedBodyHintRef = useRef<unknown>(undefined);

  // Actual on-disk/storage shape (follows api.body; chip write updates it).
  const bodyEditYamlEncoded = isStructuredYamlBody(api.body);

  useEffect(() => {
    const structured = requestData?.body ?? api.body;
    if (structured != null && typeof structured !== "string") {
      resolvedBodyHintRef.current = structured;
    }
  }, [requestData?.body, api.body]);

  const tokensTextFromYaml = useCallback(() => {
    const resolvedHint = typeof requestData?.body === "string"
      ? resolvedBodyHintRef.current
      : (requestData?.body ?? resolvedBodyHintRef.current);
    // Peer: YAML → tokens (never from resolved values).
    return yamlBodyToTokensText(
      api.body,
      resolvedRequestFormat,
      bodyValueContext,
      resolvedHint,
    );
  }, [api.body, requestData?.body, resolvedRequestFormat, bodyValueContext]);

  /** Packable body text for storage writes — always token form, never resolved values. */
  const bodyTextForStorage = useCallback(() => {
    if (bodyTokenMode === "tokens") {
      return bodyEditDraft;
    }
    return tokensTextFromYaml();
  }, [bodyTokenMode, bodyEditDraft, tokensTextFromYaml]);

  const openBodyTokens = useCallback((cursor?: BodyViewCursor) => {
    const template = tokensTextFromYaml();
    skipBodySyncRef.current = true;
    // Keep encode preference — do not reset from current storage shape
    // (mid-edit may be temporarily plain while preference is still encoded).
    setBodyEditCursor(cursor);
    setBodyEditDraft(template);
    // Remount once when entering tokens (fresh Ctrl+Z stack) — never on YAML echo.
    setBodyEditSession((n) => n + 1);
    setBodyYamlEncodeError(false);
    setBodyTokenMode("tokens");
  }, [tokensTextFromYaml]);

  /**
   * Peer write: tokens/display text → YAML body (immediate).
   * Resolved values never flow into YAML — only token text (draft or yaml→tokens).
   */
  const writeBodyStorage = useCallback((text: string, preferEncoded: boolean): boolean => {
    // Own write → ignore the following api.body echo (do not rewrite draft).
    skipBodySyncRef.current = true;
    const nextBody = tokensTextToYamlBody(
      text,
      resolvedRequestFormat,
      preferEncoded,
    ) as APIData["body"];
    const encodedOk = preferEncoded && isStructuredYamlBody(nextBody);
    setBodyYamlEncodeError(preferEncoded && !encodedOk);
    onUpdateApi?.({ body: nextBody });
    return !preferEncoded || encodedOk;
  }, [onUpdateApi, resolvedRequestFormat]);

  const handleBodyEditChange = useCallback((val: string) => {
    setBodyEditDraft(val);
    writeBodyStorage(val, bodyYamlEncodedManual);
  }, [bodyYamlEncodedManual, writeBodyStorage]);

  /** plain/encoded chip — independent of resolved/tokens view. */
  const handleBodyEditYamlEncoded = useCallback((enabled: boolean) => {
    setBodyYamlEncodedManual(enabled);
    writeBodyStorage(
      bodyTokenMode === "tokens" ? bodyEditDraft : bodyTextForStorage(),
      enabled,
    );
  }, [
    bodyTokenMode,
    bodyEditDraft,
    bodyTextForStorage,
    writeBodyStorage,
  ]);

  // External YAML edits (left pane) while in tokens mode → refresh draft only.
  // Do not bump bodyEditSession (that remounts Monaco and feels like a reload).
  // Do not touch bodyYamlEncodedManual — preference survives temporary plain fallback.
  useEffect(() => {
    if (bodyTokenMode !== "tokens") {
      return;
    }
    if (skipBodySyncRef.current) {
      skipBodySyncRef.current = false;
      return;
    }
    const template = tokensTextFromYaml();
    setBodyEditDraft((prev) => (
      normalizeNewlines(prev) === normalizeNewlines(template) ? prev : template
    ));
  }, [api.body, bodyTokenMode, tokensTextFromYaml]);

  // Prefer-encoded: when body is temporarily plain (invalid mid-edit or YAML tweak)
  // but the text packs again, snap back to structured storage.
  useEffect(() => {
    if (!bodyYamlEncodedManual) {
      return;
    }
    if (isStructuredYamlBody(api.body)) {
      setBodyYamlEncodeError(false);
      return;
    }
    if (typeof api.body !== "string" || api.body.trim() === "") {
      return;
    }
    if (skipBodySyncRef.current) {
      return;
    }
    const packed = packBodyAsYamlEncoded(api.body, resolvedRequestFormat);
    if (packed == null) {
      setBodyYamlEncodeError(true);
      return;
    }
    skipBodySyncRef.current = true;
    setBodyYamlEncodeError(false);
    onUpdateApi?.({ body: packed as APIData["body"] });
  }, [api.body, bodyYamlEncodedManual, resolvedRequestFormat, onUpdateApi]);

  // If a self-write did not change api.body, the sync effect never runs — clear skip.
  useEffect(() => {
    if (!skipBodySyncRef.current) {
      return;
    }
    const t = setTimeout(() => {
      skipBodySyncRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [api.body, bodyEditDraft]);

  const handleBodyTokenModeChange = useCallback((mode: BodyTokenMode) => {
    if (mode === bodyTokenMode) {
      return;
    }
    if (mode === "tokens") {
      openBodyTokens();
      return;
    }
    // Flush draft so resolved view / Send see the latest tokens.
    writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
    setBodyTokenMode("resolved");
  }, [
    bodyTokenMode,
    openBodyTokens,
    writeBodyStorage,
    bodyEditDraft,
    bodyYamlEncodedManual,
  ]);

  const sendWithResolvedBody = useCallback(async () => {
    if (bodyTokenMode === "tokens") {
      // Commit YAML before send so resolveApiRequest sees the draft tokens.
      flushSync(() => {
        writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
      });
    }
    await handleSend();
  }, [
    bodyTokenMode,
    bodyEditDraft,
    bodyYamlEncodedManual,
    writeBodyStorage,
    handleSend,
  ]);

  const runWithResolvedBody = useCallback(async () => {
    if (bodyTokenMode === "tokens") {
      flushSync(() => {
        writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
      });
    }
    await handleRunInCore();
  }, [
    bodyTokenMode,
    bodyEditDraft,
    bodyYamlEncodedManual,
    writeBodyStorage,
    handleRunInCore,
  ]);

  const sendContextMenuItems = useMemo(() => [
    {
      label: "Run in Core",
      icon: "codicon-play",
      onClick: runWithResolvedBody,
    },
    ...(canRunCurl ? [{
      label: "Run in Curl",
      icon: "codicon-terminal",
      onClick: () => {
        if (bodyTokenMode === "tokens") {
          flushSync(() => {
            writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
          });
        }
        window.vscode?.postMessage({
          command: "runCurlCommand",
          request: requestData,
          inputs: runInputs
        });
      }
    }] : [])
  ], [
    canRunCurl,
    runWithResolvedBody,
    requestData,
    runInputs,
    bodyTokenMode,
    bodyEditDraft,
    bodyYamlEncodedManual,
    writeBodyStorage,
  ]);

  const inputConstraints = useMemo(
    () => extractInputConstraintsFromDescription(api.description || ""),
    [api.description]
  );

  const handleExampleChange = useCallback((newIdx: number) => {
    setSelectedExampleIdx(newIdx);
    const baseInputs = newIdx === -1
      ? (api.inputs || {})
      : (examples[newIdx]?.inputs || {});
    const nextInputs = cloneInputs(baseInputs);
    setCurrentInputs(nextInputs);
    prepareRequestData(nextInputs, { respectTouched: false, forceReset: true });
  }, [api.inputs, examples, prepareRequestData, setCurrentInputs, setSelectedExampleIdx]);

  useEffect(() => {
    const onSelectExample = (event: Event) => {
      const idx = (event as CustomEvent<{ exampleIndex?: number }>).detail?.exampleIndex;
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0) {
        return;
      }
      if (idx >= examples.length) {
        return;
      }
      handleExampleChange(idx);
    };
    window.addEventListener(SELECT_EXAMPLE_EVENT, onSelectExample);
    return () => window.removeEventListener(SELECT_EXAMPLE_EVENT, onSelectExample);
  }, [examples.length, handleExampleChange]);

  const handleInputsChange = (data: JSONRecord) => {
    setCurrentInputs(data);
    prepareRequestData(data, { respectTouched: false });
    if (selectedExampleIdx >= 0 && examples[selectedExampleIdx]) {
      const nextExamples = examples.map((ex, i) => {
        if (i !== selectedExampleIdx) {
          return ex;
        }
        const updated = { ...ex };
        if (Object.keys(data).length > 0) {
          updated.inputs = cloneInputs(data);
        } else {
          delete updated.inputs;
        }
        return updated;
      });
      onUpdateApi?.({ examples: nextExamples });
      return;
    }
    const match = findMatchingExampleIndex(examples, data);
    if (match !== selectedExampleIdx) {
      setSelectedExampleIdx(match);
    }
  };

  const handleAddAsTest = () => {
    const newExampleNameBase = "example";
    let newId = newExampleNameBase;
    const idSet = new Set(
      (api.examples || [])
        .map(e => exampleId(e) || "")
        .filter(Boolean)
        .map(id => id.toLowerCase()),
    );
    let counter = 1;
    while (idSet.has(newId.toLowerCase())) {
      newId = `${newExampleNameBase}${counter++}`;
    }

    const newExample: { id: string; title?: string; inputs?: JSONRecord; expect?: JSONRecord } = {
      id: newId,
      title: newId,
    };
    if (Object.keys(currentInputs).length) {
      newExample.inputs = cloneInputs(currentInputs);
    }

    // Snapshot extracted output values into soft expect (equality checks).
    const definedOutputKeys = Object.keys(api.outputs || {});
    if (definedOutputKeys.length > 0) {
      const exampleExpect: JSONRecord = {};
      definedOutputKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(outputs, key)) {
          exampleExpect[key] = outputs[key];
        }
      });
      if (Object.keys(exampleExpect).length > 0) {
        newExample.expect = exampleExpect;
      }
    }

    const updatedExamples = [...(api.examples || []), newExample];
    onUpdateApi?.({ examples: updatedExamples });
    setSelectedExampleIdx(updatedExamples.length - 1);
  };

  const requestOverflowTabs = useMemo((): OverflowTabItem<EditorTab>[] => {
    return TAB_OPTIONS
      .filter(tab => {
        if ((isGraphQL || isGrpc) && (tab.key === "body" || tab.key === "params" || tab.key === "cookies")) {
          return false;
        }
        if (tab.protocol) {
          if (tab.protocol === "graphql") { return isGraphQL; }
          if (tab.protocol === "grpc") { return isGrpc; }
        }
        return true;
      })
      .map(tab => {
        const count = tab.key === "headers"
          ? countNamedEntries(api.headers)
          : tab.key === "cookies"
            ? countNamedEntries(api.cookies)
            : tab.key === "inputs"
              ? countNamedEntries(api.inputs as Record<string, unknown> | undefined)
              : 0;
        return {
          id: tab.key,
          label: tab.label,
          count: count > 0 ? count : undefined,
          iconOnly: tab.iconOnly,
          buttonClassName: tab.iconOnly ? "apitest-tab-settings" : undefined,
          title: tab.iconOnly ? tab.label : undefined,
          "aria-label": tab.iconOnly ? tab.label : undefined,
        };
      });
  }, [api.cookies, api.headers, api.inputs, isGraphQL, isGrpc]);

  const responseOverflowTabs = useMemo((): OverflowTabItem<ResponseTab>[] => {
    return RESPONSE_TAB_OPTIONS.map(tab => {
      const count = tab.key === "headers"
        ? countNamedEntries(responseData?.headers)
        : tab.key === "cookies"
          ? countNamedEntries(responseData?.cookies)
          : tab.key === "outputs"
            ? outputKeys.length + setenvKeys.length
            : 0;
      return {
        id: tab.key,
        label: tab.label,
        count: count > 0 ? count : undefined,
      };
    });
  }, [outputKeys.length, responseData?.cookies, responseData?.headers, setenvKeys.length]);

  return (
    <div className={`apitest-root${selector ? " apitest-root--source" : ""}`}>
      {/* ── Fixed header: URL bar + Send ── */}
      <div className="apitest-fixed-header">
      <div className="apitest-url-row" style={methodChromeVars as React.CSSProperties}>
        {selector}
        <MethodUrlBar
          methodValue={methodOrProtocolValue}
          onMethodChange={handleMethodOrProtocolChange}
          url={peerUrl}
          query={peerQuery}
          onUrlChange={onUrlChange}
          onQueryChange={onQueryChange}
          canContainToken
          valueContext={bodyValueContext}
        />
        <div className="apitest-url-send">
          {isWsUrl && (
            <ConnectButton
              connected={network.connected}
              onClick={handleConnect}
            />
          )}
          <HideWhenYamlError>
            <SendButton
              accent={methodOrProtocolAccent}
              onClick={sendWithResolvedBody}
              onCancel={handleCancel}
              disabled={isWsUrl && !network.connected}
              loading={isWsUrl ? network.loading : isSending}
              contextMenuItems={sendContextMenuItems}
            />
          </HideWhenYamlError>
        </div>
        {rightOfUrlButton && (
          <div className="apitest-url-row-actions">
            {rightOfUrlButton}
          </div>
        )}
      </div>
      </div>

      {/* ── Request | Response split ── */}
      <div className="apitest-content" ref={contentRef}>
      <SplitPane
        split="horizontal"
        size={requestPaneSize}
        onChange={handleRequestPaneResize}
        minSize={100}
        maxSize={-100}
        resizerClassName="Resizer"
        className="apitest-split"
        pane1ClassName="apitest-split-pane"
        pane2ClassName="apitest-split-pane"
      >
      <div className="apitest-request-pane">
      <div className="apitest-tabs-row">
        <OverflowTabBar
          tabs={requestOverflowTabs}
          value={editorTab}
          onChange={setEditorTab}
          variant="small"
          showRule={false}
          gap
        />
        <div
          className={`apitest-tabs-tools${shouldShowBody() ? "" : " is-hidden"}`}
          aria-hidden={!shouldShowBody()}
        >
            <div className="apitest-body-toolbar-main">
              <BodyFormatBar
                value={currentRequestFormat}
                onChange={format => setBodyFormat("request", format)}
              />
              {resolvedRequestFormat !== "none"
                && resolvedRequestFormat !== "text"
                && resolvedRequestFormat !== "binary"
                && resolvedRequestFormat !== "multipart" ? (
                <>
                  <span className="apitest-body-format-divider" aria-hidden />
                  <div
                    className="apitest-body-format-bar-group"
                    role="radiogroup"
                    aria-label="Body storage"
                  >
                    <FormatChip
                      label="plain"
                      selected={!bodyEditYamlEncoded}
                      title="Store body as a text block"
                      onClick={() => handleBodyEditYamlEncoded(false)}
                    />
                    <FormatChip
                      label="encoded"
                      selected={bodyEditYamlEncoded}
                      overlined={bodyYamlEncodeError}
                      title={bodyYamlEncodeError
                        ? "Encoded preferred — using plain until the body is valid again"
                        : "Store body as structured YAML instead of a text block"}
                      onClick={() => handleBodyEditYamlEncoded(true)}
                    />
                  </div>
                </>
              ) : null}
              {resolvedRequestFormat !== "none"
                && resolvedRequestFormat !== "binary"
                && resolvedRequestFormat !== "multipart" ? (
                <>
                  <span className="apitest-body-format-divider" aria-hidden />
                  <div
                    className="apitest-body-format-bar-group"
                    role="radiogroup"
                    aria-label="Body display"
                  >
                    <FormatChip
                      label="resolved"
                      selected={bodyTokenMode === "resolved"}
                      title="Show resolved input/env values"
                      onClick={() => handleBodyTokenModeChange("resolved")}
                    />
                    <FormatChip
                      label="tokens"
                      selected={bodyTokenMode === "tokens"}
                      title="Edit {{i:}} / {{e:}} / {{r:}} / {{c:}} tokens"
                      onClick={() => handleBodyTokenModeChange("tokens")}
                    />
                  </div>
                </>
              ) : null}
            </div>
        </div>
      </div>
      <FadePane paneKey={editorTab} className="apitest-pane-fill" durationMs={100}>

      {shouldShowDoc() ? (
        <div className="apitest-section apitest-section--doc panel-form">
          <div className="panel-form-row">
            <SectionEditLabel
              label="Title"
              editing={editTitle}
              onEdit={() => setEditTitle(true)}
            />
            {editTitle ? (
              <div>
                <input
                  value={api.title || ""}
                  onChange={e => onUpdateApi?.({ title: e.target.value })}
                  placeholder="title"
                  disabled={!onUpdateApi}
                />
                <SectionEditDone onDone={() => setEditTitle(false)} />
              </div>
            ) : (
              <div className={api.title ? "apitest-doc-plain" : "apitest-empty"}>
                {api.title || "No title"}
              </div>
            )}
          </div>

          <div className="panel-form-row">
            <SectionEditLabel
              label="Tags"
              editing={editTags}
              onEdit={() => setEditTags(true)}
            />
            {editTags ? (
              <div>
                <SearchableTagInput
                  tags={safeList(api.tags)}
                  onChange={tags => onUpdateApi?.({ tags })}
                  suggestions={["security", "sessionless", "api", "user", "admin"]}
                />
                <SectionEditDone onDone={() => setEditTags(false)} />
              </div>
            ) : safeList(api.tags).length > 0 ? (
              <div className="apitest-doc-plain">
                {safeList(api.tags).join(", ")}
              </div>
            ) : (
              <div className="apitest-empty">No tags</div>
            )}
          </div>

          <div className="panel-form-row">
            <SectionEditLabel
              label="Description"
              editing={editDescription}
              onEdit={() => setEditDescription(true)}
            />
            {editDescription ? (
              <div>
                <DescriptionEditor
                  value={api.description || ""}
                  onChange={value => onUpdateApi?.({ description: value })}
                />
                <SectionEditDone onDone={() => setEditDescription(false)} />
              </div>
            ) : api.description ? (
              <MdViewer
                description={api.description}
                inputs={api.inputs}
                outputs={api.outputs}
                showDescriptionLabel={false}
              />
            ) : (
              <div className="apitest-empty">No description available.</div>
            )}
          </div>
        </div>
      ) : shouldShowSettings() ? (
        <div className="apitest-section apitest-section--settings">
          {onUpdateApi ? (
            <ApiSettingsEditor api={api} update={onUpdateApi} />
          ) : (
            <div className="apitest-empty">Settings are read-only.</div>
          )}
        </div>
      ) : shouldShowAuth() ? (
        <div className="apitest-section apitest-section--auth">
          {onUpdateApi ? (
            <ApiAuthEditor api={api} update={onUpdateApi} />
          ) : (
            <div className="apitest-empty">Auth is read-only.</div>
          )}
        </div>
      ) : (
        <div className="apitest-section">
        {shouldShowQuery() && <KSVEditor
          label=""
          value={peerQuery}
          onChange={onQueryChange}
          commitMode="blur"
          canContainToken
          valueContext={bodyValueContext}
        />}
        {shouldShowHeaders() && <KSVEditor
          label=""
          value={peerHeaders}
          onChange={onHeadersChange}
          commitMode="blur"
          canContainToken
          valueContext={bodyValueContext}
        />}
        {shouldShowCookies() && <KSVEditor
          label=""
          value={peerCookies}
          onChange={onCookiesChange}
          commitMode="blur"
          canContainToken
          valueContext={bodyValueContext}
        />}
        {shouldShowBody() && (
          <div className="apitest-body-pane">
            {requestBodyDisabled ? (
              <div className="apitest-body-none" role="status">
                <span className="codicon codicon-jersey apitest-body-none-icon" aria-hidden />
                <div className="apitest-body-none-message">Request has no body.</div>
              </div>
            ) : (
              <div
                className="apitest-body-wrapper"
                data-mmt-coach="body"
              >
                {resolvedRequestFormat === "binary" ? (
                  <FilePickerInput
                    value={peerStringToDisplay(
                      typeof api.body === "string" ? api.body : "",
                    )}
                    basePath={mmtFilePath}
                    showFilePicker
                    placeholder="Relative path to binary file"
                    canContainToken
                    valueContext={bodyValueContext}
                    onChange={val => onUpdateApi?.({ body: peerStringToYaml(val) })}
                    onEnterPressed={val => onUpdateApi?.({ body: peerStringToYaml(val) })}
                  />
                ) : resolvedRequestFormat === "multipart" ? (
                  <MultipartPartsEditor
                    value={api.body}
                    onChange={parts => onUpdateApi?.({ body: parts as APIData["body"] })}
                    canContainToken
                    valueContext={bodyValueContext}
                  />
                ) : bodyTokenMode === "tokens" ? (
                  <BodyView
                    key={`body-tokens-${bodyEditSession}`}
                    value={bodyEditDraft}
                    format={resolvedRequestFormat}
                    mode="live"
                    onChange={handleBodyEditChange}
                    initialCursor={bodyEditCursor}
                    valueContext={bodyValueContext}
                  />
                ) : (
                  <BodyView
                    key="body-resolved"
                    value={requestBodyDisplay}
                    format={resolvedRequestFormat}
                    mode="live"
                    onStartEdit={openBodyTokens}
                    valueContext={bodyValueContext}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {shouldShowGraphql() && (
          <>
            <div className="label">Operation</div>
            <div className="apitest-body-wrapper">
              <BodyView
                value={peerGraphqlOperation}
                format="graphql"
                mode="live"
                onChange={val => {
                  onUpdateApi?.({
                    graphql: {
                      operation: peerStringToYaml(val),
                      operationName: api.graphql?.operationName,
                      variables: api.graphql?.variables,
                    },
                  });
                }}
              />
            </div>
            <KSVEditor
              label="Variables"
              value={peerGraphqlVariables}
              commitMode="blur"
              canContainToken
              valueContext={bodyValueContext}
              onChange={variables => {
                onUpdateApi?.({
                  graphql: {
                    operation: api.graphql?.operation ?? "",
                    operationName: api.graphql?.operationName,
                    variables: peerRecordToYaml(variables),
                  },
                });
              }}
            />
          </>
        )}

        {shouldShowGrpc() && (
          <>
            <div className="field-inline is-gap is-spaced">
              <div className="field-grow">
                <div className="label">Service</div>
                <BlurCommitInput
                  type="text"
                  placeholder="package.ServiceName"
                  value={api.grpc?.service || ""}
                  onCommit={service => {
                    onUpdateApi?.({
                      grpc: {
                        proto: api.grpc?.proto,
                        service,
                        method: api.grpc?.method ?? "",
                        message: api.grpc?.message,
                        stream: api.grpc?.stream,
                      },
                    });
                  }}
                  className="mmt-fill"
                />
              </div>
              <div className="field-grow">
                <div className="label">Method</div>
                <BlurCommitInput
                  type="text"
                  placeholder="MethodName"
                  value={api.grpc?.method || ""}
                  onCommit={method => {
                    onUpdateApi?.({
                      grpc: {
                        proto: api.grpc?.proto,
                        service: api.grpc?.service ?? "",
                        method,
                        message: api.grpc?.message,
                        stream: api.grpc?.stream,
                      },
                    });
                  }}
                  className="mmt-fill"
                />
              </div>
            </div>
            <KSVEditor
              label="Message"
              value={peerGrpcMessage}
              commitMode="blur"
              canContainToken
              valueContext={bodyValueContext}
              onChange={msg => {
                onUpdateApi?.({
                  grpc: {
                    proto: api.grpc?.proto,
                    service: api.grpc?.service ?? "",
                    method: api.grpc?.method ?? "",
                    message: peerRecordToYaml(msg),
                    stream: api.grpc?.stream,
                  },
                });
              }}
            />
          </>
        )}

        {shouldShowInputs() && (
          <>
            <div className="apitest-example">
              <div className="label">Example</div>
              <div className="field-inline is-gap">
                <select
                  value={selectedExampleIdx ?? -1}
                  onChange={e => {
                    const newIdx = Number(e.target.value);
                    handleExampleChange(newIdx);
                  }}
                  className="field-grow"
                >
                  <option value={-1}>Select...</option>
                  {examples
                    .filter(ex => ex && typeof ex === "object")
                    .map((ex, idx) => {
                      const id = exampleId(ex);
                      const titleOnly = typeof ex.title === "string" && ex.title.trim()
                        ? ex.title.trim()
                        : undefined;
                      const label = id && titleOnly
                        ? `${id} - ${titleOnly}`
                        : (id || titleOnly || exampleTitle(ex) || `Example ${idx + 1}`);
                      return (
                        <option key={id || idx} value={idx}>
                          {label}
                        </option>
                      );
                    })}
                </select>
                <button
                  type="button"
                  className="button-icon no-shrink"
                  onClick={handleAddAsTest}
                  title="Add current inputs as a new example"
                  aria-label="Add current inputs as a new example"
                >
                  <span className="codicon codicon-add" aria-hidden />
                </button>
              </div>
            </div>
            <SectionEditLabel
              label="Inputs"
              editing={editInputsDecl}
              onEdit={() => setEditInputsDecl(true)}
            />
            {editInputsDecl ? (
              <div>
                <KVEditor
                  label=""
                  value={api.inputs}
                  onChange={kv => onUpdateApi?.({ inputs: kv })}
                  keyPlaceholder="name"
                  valuePlaceholder="value"
                  canContainToken
                  valueContext={bodyValueContext}
                  disabled={!onUpdateApi}
                />
                <SectionEditDone onDone={() => setEditInputsDecl(false)} />
              </div>
            ) : (
              <VEditor
                label=""
                value={currentInputs}
                onChange={handleInputsChange}
                keyOptions={typeof api.inputs === "object" ? Object.keys(api.inputs || {}) : []}
                inputConstraints={inputConstraints}
                deletable={false}
                canContainToken
                valueContext={bodyValueContext}
              />
            )}
            {selectedExampleIdx >= 0 && examples[selectedExampleIdx] ? (
              <ApiTestsEditor
                test={{
                  expect: exampleExpect(examples[selectedExampleIdx]),
                }}
                results={apiTestResults}
                fieldSuggestions={outputFieldSuggestions}
                canContainToken
                valueContext={bodyValueContext}
                onChange={(next) => {
                  const nextExamples = examples.map((ex, i) => {
                    if (i !== selectedExampleIdx) {
                      return ex;
                    }
                    const updated = { ...ex };
                    // Migrating off deprecated outputs when writing expect.
                    if (updated.outputs !== undefined) {
                      delete updated.outputs;
                    }
                    if (next?.expect) {
                      updated.expect = next.expect;
                    } else {
                      delete updated.expect;
                    }
                    return updated;
                  });
                  onUpdateApi?.({ examples: nextExamples });
                }}
              />
            ) : null}
          </>
        )}

        </div>
      )}

      </FadePane>
      </div>

      <div className="apitest-response-pane">
      <div className="apitest-tabs-row apitest-response-tabs-row">
        <OverflowTabBar
          tabs={responseOverflowTabs}
          value={responseTab}
          onChange={setResponseTab}
          variant="small"
          showRule={false}
          gap
        />
        {responseData ? (
          <>
            <div
              className={`apitest-tabs-tools${shouldShowResponse() ? "" : " is-hidden"}`}
              aria-hidden={!shouldShowResponse()}
            >
              <ResponseBodyBar
                type={currentResponseFormat}
                view={responseDisplay.effectiveView}
                prettyAvailable={responseDisplay.prettyAvailable}
                previewAvailable={responseDisplay.previewAvailable}
                onTypeChange={type => setBodyFormat("response", type)}
                onViewChange={setResponseViewMode}
              />
            </div>
            <span
              className={`apitest-tabs-tools-divider${shouldShowResponse() ? "" : " is-hidden"}`}
              aria-hidden
            />
          </>
        ) : null}
        <div className="apitest-response-meta">
          {(responseData?.duration) && <ResponseDuration duration={responseData.duration} />}
          {(responseData) && (
            <ResponseStatus
              protocol={requestData?.protocol}
              status={responseData.status}
              errorMessage={responseData.errorMessage}
              errorCode={responseData.errorCode}
              warning={responseData.warning}
              onClick={() => showHistoryPanel({ openLatest: true })}
            />
          )}
          {responseData ? (
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              onClick={clearResponse}
              title="Clear response"
              aria-label="Clear response"
            >
              <span className="codicon codicon-eraser" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="button-icon no-shrink section-edit-toggle"
            onClick={() => {
              showHistoryPanel();
            }}
            title="Show History Panel"
            aria-label="Show History Panel"
          >
            <span className="codicon codicon-history" aria-hidden />
          </button>
        </div>
      </div>
      <FadePane paneKey={responseTab} className="apitest-pane-fill" durationMs={100}>
      <div className="apitest-section">
        {shouldShowOutputs() && (
          <>
            <SectionEditLabel
              label="Outputs"
              editing={editOutputsDecl}
              onEdit={() => setEditOutputsDecl(true)}
            />
            {editOutputsDecl ? (
              <div>
                <KSVEditor
                  label=""
                  value={api.outputs}
                  onChange={kv => onUpdateApi?.({ outputs: kv })}
                  keyPlaceholder="name"
                  valuePlaceholder="value"
                  disabled={!onUpdateApi}
                />
                <SectionEditDone onDone={() => setEditOutputsDecl(false)} />
              </div>
            ) : outputKeys.length > 0 ? (
              <VEditor
                label=""
                value={outputDisplay}
                onChange={() => { }}
                keyOptions={outputKeys}
                readOnly
                deletable={false}
                copyable
                matchStatus={outputMatchStatus}
              />
            ) : (
              <div className="apitest-empty">No outputs defined.</div>
            )}
            <SectionEditLabel
              label="Setenv"
              editing={editSetenvDecl}
              onEdit={() => setEditSetenvDecl(true)}
            />
            {editSetenvDecl ? (
              <div>
                <KSVEditor
                  label=""
                  value={api.setenv}
                  onChange={kv => onUpdateApi?.({ setenv: kv })}
                  keyPlaceholder="name"
                  valuePlaceholder="body.path or regex"
                  disabled={!onUpdateApi}
                />
                <SectionEditDone onDone={() => setEditSetenvDecl(false)} />
              </div>
            ) : setenvKeys.length > 0 ? (
              <VEditor
                label=""
                value={setenvDisplay}
                onChange={() => { }}
                keyOptions={setenvKeys}
                readOnly
                deletable={false}
                copyable
              />
            ) : (
              <div className="apitest-empty">No setenv variables defined.</div>
            )}
          </>
        )}

        {!responseData && (shouldShowResponse() || shouldShowResponseHeaders() || shouldShowResponseCookies()) ? (
          <NoResponseYet onSend={sendWithResolvedBody} />
        ) : (
          <>
        {shouldShowResponseHeaders() && (
          countNamedEntries(responseData?.headers) > 0 ? (
            <KSVEditor
              label=""
              value={responseData?.headers || {}}
              onChange={() => { }}
              deactivated={true}
            />
          ) : (
            <div className="apitest-empty">No response headers.</div>
          )
        )}

        {shouldShowResponseCookies() && (
          countNamedEntries(responseData?.cookies) > 0 ? (
            <KSVEditor
              label=""
              value={responseData?.cookies || {}}
              onChange={() => { }}
              deactivated={true}
            />
          ) : (
            <div className="apitest-empty">No response cookies.</div>
          )
        )}

        {shouldShowResponse() && (
          <div className="apitest-body-pane">
            <div className="apitest-body-wrapper">
              <ResponseBodyContent
                display={responseDisplay}
                refreshKey={responseRevision}
                requestUrl={requestData?.url}
                onInspectPosition={handleAddOutputVariable}
              />
            </div>
          </div>
        )}
          </>
        )}
      </div>
      </FadePane>
      </div>
      </SplitPane>
      </div>
    </div>
  );
};

export default APITest;
