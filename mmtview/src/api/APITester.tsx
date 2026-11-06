import { TokenModeContext } from "../components/TokenModeContext";
import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { SplitPane } from "@rexxars/react-split-pane";
import { extractInputConstraintsFromDescription } from "mmt-core/api-edit/paramConstraints";
import { APIData, exampleExpect, exampleId, exampleTitle } from "mmt-core/data/APIData";
import { JSONRecord, JSONValue, Method, Protocol, RequestFormat, ResponseFormat, requestFormat, responseFormat } from "mmt-core/data/CommonData";
import { resolveRequestFormat } from "mmt-core/tokens/formatResolve";
import KSVEditor from "../components/KSVEditor";
import StableTextInput from "../components/StableTextInput";
import BodyView, { type BodyViewCursor } from "../components/BodyView";
import type { BodyViewToolbarState } from "../components/BodyView";
import { BodyViewValidationIndicator } from "../components/BodyViewToolbarControls";
import FilePickerInput from "../components/FilePickerInput";
import MultipartPartsEditor from "../components/MultipartPartsEditor";
import {
  displayRequestBody,
  leafResolvesToOmit,
  packBodyAsYamlEncoded,
  tokensTextToYamlBody,
  valueForYamlSave,
  yamlBodyToTokensText,
} from "mmt-core/api-edit/apiBodyEdit";
import { normalizeNewlines } from "mmt-core/util/textLines";
import { applyFormatSideEdit } from "mmt-core/api-edit/apiFormatEdit";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { HideWhenYamlError } from "./YamlErrorWarning";
import { sendShortcutLabel, usePrimaryAction } from "../primaryAction";
import MethodUrlBar from "../components/MethodUrlBar";
import {
  inputBoxToYamlValueWithTokens,
  stringFieldToYamlWithLiveTokens,
  yamlValueToInputBoxWithTokens,
} from "../components/convertor";
import BodyFormatBar from "../components/BodyFormatBar";
import ResponseBodyBar from "../components/ResponseBodyBar";
import ResponseBodyContent from "../components/ResponseBodyContent";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";
import VEditor from "../components/VEditor";
import { FileContext } from "../fileContext";
import { showEnvironmentPanel, showHistoryPanel } from "../vsAPI";
import { useAPITesterLogic } from "./useAPITesterLogic";
import RequestModeDrawer, {
  type RequestViewMode,
} from "./RequestModeDrawer";
import {
  resolveResponseDisplayState,
  type ResponseViewMode,
} from "./responseBodyDisplay";
import { protocolResolver } from "mmt-core";
import { resolveApiHttpMethod } from "mmt-core/network/apiMethod";
import MdViewer from "../components/MdViewer";
import DescriptionEditor from "../components/DescriptionEditor";
import SearchableTagInput from "../components/SearchableTagInput";
import SectionEditLabel, { SectionEditDone } from "../components/SectionEditLabel";
import FadePane from "../components/FadePane";
import KVEditor from "../components/KVEditor";
import { safeList } from "mmt-core/util/safer";
import ApiTestsEditor from "./ApiTestsEditor";
import ApiSettingsEditor from "./ApiSettingsEditor";
import ApiAuthEditor from "./ApiAuthEditor";
import { formatBody } from "mmt-core/parse/markupConvertor";
import OverflowTabBar, { type OverflowTabItem } from "../components/OverflowTabBar";
import {
  accentChromeCssVars,
  accentChromeFor,
} from "../shared/themeAccent";
import { findMatchingExampleIndex } from "./apiExampleMatch";
import { SELECT_EXAMPLE_EVENT } from "../text/exampleSelect";
import { selectBodyFormatStorage } from "./bodyFormatSelection";
import { useKeptTabs } from "../useKeptTabs";
import {
  computeDirtyInputKeys,
  restoreInputKeyFromBaseline,
  stableEqual,
} from "../test/testUiRefresh";

function KeptTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={["apitest-tab-panel", active ? "is-active" : undefined].filter(Boolean).join(" ")}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

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
type RequestResponseLayout = "stacked" | "side-by-side";

function countNamedEntries(record?: Record<string, unknown> | null): number {
  if (!record) {
    return 0;
  }
  return Object.keys(record).filter(key => key.trim().length > 0).length;
}

/** Empty / in-flight overlay for the response pane. */
const NoResponseYet: React.FC<{
  onSend: () => void;
  onCancel?: () => void;
  sending?: boolean;
  /** Dim previous response; opaque when there is nothing underneath. */
  dimmed?: boolean;
}> = ({
  onSend,
  onCancel,
  sending = false,
  dimmed = false,
}) => (
  <div
    className={[
      "apitest-body-none",
      "apitest-no-response",
      "apitest-response-overlay",
      sending ? "is-sending" : "",
      dimmed ? "is-dimmed" : "is-opaque",
    ].filter(Boolean).join(" ")}
    role="status"
    aria-live="polite"
  >
    <span
      className={`codicon apitest-body-none-icon${
        sending ? " codicon-loading codicon-modifier-spin" : " codicon-send"
      }`}
      aria-hidden
    />
    <div className="apitest-body-none-message">
      {sending ? (
        <>
          <div className="apitest-body-none-title">Sending request…</div>
          <div className="apitest-body-none-hint">
            <div>
              Click{" "}
              <button
                type="button"
                className="apitest-empty-ui-btn"
                onClick={onCancel}
                title="Cancel (Esc)"
              >
                <span className="codicon codicon-close" aria-hidden />
                <span className="apitest-empty-ui-btn-label">Cancel</span>
              </button>
              {" "}or press Esc
            </div>
            <div>to cancel.</div>
          </div>
        </>
      ) : (
        <>
          <div className="apitest-body-none-title">No response yet.</div>
          <div className="apitest-body-none-hint">
            <div>
              Click{" "}
              <button
                type="button"
                className="apitest-empty-ui-btn"
                onClick={onSend}
                title={`Send (${sendShortcutLabel()})`}
              >
                <span className="codicon codicon-send" aria-hidden />
                <span className="apitest-empty-ui-btn-label">Send</span>
              </button>
              {" "}or press {sendShortcutLabel()}
            </div>
            <div>to run the request.</div>
          </div>
        </>
      )}
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
const REQUEST_RESPONSE_LAYOUT_KEY = "apitest-request-response-layout";
const SIDE_BY_SIDE_PANE_RATIO_KEY = "apitest-side-by-side-pane-ratio";
const RESPONSE_TAB_KEY = "apitest-response-tab";
const REQUEST_VIEW_MODE_KEY = "apitest-request-view-mode";
/** @deprecated migrated to REQUEST_VIEW_MODE_KEY */
const BODY_TOKEN_MODE_KEY = "apitest-body-token-mode";
const DEFAULT_REQUEST_PANE_RATIO = 0.5;

function readStoredRequestViewMode(): RequestViewMode {
  const saved = localStorage.getItem(REQUEST_VIEW_MODE_KEY);
  if (saved === "edit" || saved === "telescope" || saved === "sandbox") {
    return saved;
  }
  const legacy = localStorage.getItem(BODY_TOKEN_MODE_KEY);
  if (legacy === "resolved") {
    return "telescope";
  }
  if (legacy === "tokens") {
    return "edit";
  }
  return "edit";
}

function tokenDisplayModeFor(viewMode: RequestViewMode): "tokens" | "resolved" | "sandbox" {
  if (viewMode === "edit") {
    return "tokens";
  }
  if (viewMode === "sandbox") {
    return "sandbox";
  }
  return "resolved";
}

function cloneApiData(source: APIData): APIData {
  try {
    return JSON.parse(JSON.stringify(source)) as APIData;
  } catch {
    return { ...source };
  }
}

const MIN_REQUEST_PANE_RATIO = 0.15;
const MAX_REQUEST_PANE_RATIO = 0.85;

/** URL bar text for a typed query map. Same spelling as a header value. */
function queryForUrlBar(query?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    out[key] = yamlValueToInputBoxWithTokens(value as JSONValue, true, true);
  }
  return out;
}

/** URL bar writes strings. Coerce them with the header / input-box rules. */
function queryFromUrlBar(query: Record<string, string>): JSONRecord {
  const out: JSONRecord = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = inputBoxToYamlValueWithTokens(value, true, true);
  }
  return out;
}

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
  const { mmtFilePath, yamlErrors } = useContext(FileContext);
  const [requestViewMode, setRequestViewMode] = useState<RequestViewMode>(() =>
    readStoredRequestViewMode(),
  );
  /**
   * Fully isolated sandbox session: a clone of the YAML model.
   * Edit/Telescope peer the file; Sandbox peers only this clone.
   */
  const [sandboxApi, setSandboxApi] = useState<APIData | null>(null);
  /** Remount request editors when the session identity changes (enter/leave). */
  const [requestUiEpoch, setRequestUiEpoch] = useState(0);
  /** Runtime inputs / example selection restored when the sandbox session is dropped. */
  const sandboxRuntimeSnapshotRef = useRef<{
    inputs: JSONRecord;
    exampleIdx: number;
    dirtyKeys: string[];
    baseline: JSONRecord;
  } | null>(null);
  const isSandbox = requestViewMode === "sandbox";
  const sessionApi = isSandbox && sandboxApi ? sandboxApi : api;

  /** Bumps TokenFieldInput after r:/c: preview cache seed (open / telescope / Send). */
  const [tokenPreviewEpoch, setTokenPreviewEpoch] = useState(0);
  const onRuntimePreviewSeeded = useCallback(() => {
    setTokenPreviewEpoch((n) => n + 1);
  }, []);

  /** Single write path: YAML file, or sandbox clone — never both. */
  const updateSession = useCallback((patch: Partial<APIData>) => {
    if (Object.keys(patch).length === 0) {
      return;
    }
    if (requestViewMode === "sandbox") {
      setSandboxApi((prev) => ({
        ...(prev ?? cloneApiData(api)),
        ...patch,
      }));
      return;
    }
    onUpdateApi?.(patch);
  }, [requestViewMode, api, onUpdateApi]);

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
    handleAddOutputExpression,
    prepareRequestData,
    discardRequestScratch,
    handleSend,
    handleRunInCore,
    handleCancel,
    clearResponse,
    handleConnect,
    network,
    examples,
    isSending,
  } = useAPITesterLogic({
    api: sessionApi,
    onUpdateApi: updateSession,
    filePath: mmtFilePath,
    initialExampleIndex,
    onRuntimePreviewSeeded,
    sandboxMode: isSandbox,
  });

  const bodyValueContext = useMemo(
    () => ({ inputs: currentInputs, env: envValues }),
    [currentInputs, envValues],
  );
  const [requestBodyToolbar, setRequestBodyToolbar] = useState<BodyViewToolbarState | null>(null);
  const [responseBodyToolbar, setResponseBodyToolbar] = useState<BodyViewToolbarState | null>(null);
  const tokenModeState = useMemo(
    () => ({
      mode: tokenDisplayModeFor(requestViewMode),
      previewEpoch: tokenPreviewEpoch,
    }),
    [requestViewMode, tokenPreviewEpoch],
  );
  const bodyTokenMode = requestViewMode === "edit" ? "tokens" : "resolved";
  /** Snapshot of Inputs as loaded from YAML / selected example (before manual edits). */
  const inputsBaselineRef = useRef<JSONRecord>({});
  const baselineExampleIdxRef = useRef<number | null>(null);
  const [dirtyInputKeys, setDirtyInputKeys] = useState<Set<string>>(new Set());

  const adoptInputsBaseline = useCallback((source: JSONRecord, exampleIdx: number) => {
    const cloned = cloneInputs(source);
    inputsBaselineRef.current = cloned;
    baselineExampleIdxRef.current = exampleIdx;
    setDirtyInputKeys(new Set());
    return cloned;
  }, []);

  useEffect(() => {
    onRequestReset?.(() => {
      setBodyYamlEncodedManual(isStructuredYamlBody(api.body));
      setBodyYamlEncodeError(false);
      const baseInputs = selectedExampleIdx === -1
        ? (api.inputs || {})
        : (examples[selectedExampleIdx]?.inputs || {});
      const nextInputs = adoptInputsBaseline(baseInputs, selectedExampleIdx);
      setCurrentInputs(nextInputs);
      prepareRequestData(nextInputs, { forceReset: true, scopes: ["all"] });
    });
  }, [
    onRequestReset,
    prepareRequestData,
    api,
    examples,
    selectedExampleIdx,
    setCurrentInputs,
    adoptInputsBaseline,
  ]);

  // Keep reset baseline in sync with YAML defaults / example selection.
  // When an example is selected, freeze that snapshot so later writes into
  // `examples[i].inputs` do not move the reset target.
  useEffect(() => {
    if (selectedExampleIdx === -1) {
      const source = cloneInputs(api.inputs || {});
      if (
        baselineExampleIdxRef.current === -1
        && stableEqual(inputsBaselineRef.current, source)
      ) {
        return;
      }
      inputsBaselineRef.current = source;
      baselineExampleIdxRef.current = -1;
      setDirtyInputKeys(computeDirtyInputKeys(currentInputs, source));
      return;
    }
    if (baselineExampleIdxRef.current === selectedExampleIdx) {
      return;
    }
    const source = cloneInputs(examples[selectedExampleIdx]?.inputs || {});
    inputsBaselineRef.current = source;
    baselineExampleIdxRef.current = selectedExampleIdx;
    // Hook may still be populating currentInputs on first paint; treat empty as clean.
    setDirtyInputKeys(
      Object.keys(currentInputs).length === 0
        ? new Set()
        : computeDirtyInputKeys(currentInputs, source),
    );
  }, [api.inputs, selectedExampleIdx, examples, currentInputs]);

  const bodyPackReadyRef = useRef(false);
  useEffect(() => {
    // Seed storage preference from the newly opened file only.
    // The pack effect below must not run on this same open — its state is
    // still the previous file's preference until this update renders.
    bodyPackReadyRef.current = false;
    setBodyYamlEncodedManual(isStructuredYamlBody(api.body));
    setBodyYamlEncodeError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on file switch
  }, [mmtFilePath]);

  useEffect(() => {
    // Never persist sandbox — reopen in edit/telescope only.
    if (requestViewMode === "sandbox") {
      return;
    }
    localStorage.setItem(REQUEST_VIEW_MODE_KEY, requestViewMode);
  }, [requestViewMode]);

  // Sandbox is YAML-driven: when the file model changes, replace scratch UI.
  const sandboxYamlSyncRef = useRef(api);
  useEffect(() => {
    if (requestViewMode !== "sandbox") {
      sandboxYamlSyncRef.current = api;
      return;
    }
    if (sandboxYamlSyncRef.current === api) {
      return;
    }
    sandboxYamlSyncRef.current = api;
    const clone = cloneApiData(api);
    setSandboxApi(clone);
    setRequestUiEpoch((n) => n + 1);
    // File wins: reset runtime inputs to the new YAML defaults.
    const nextInputs = adoptInputsBaseline(clone.inputs || {}, -1);
    setSelectedExampleIdx(-1);
    setCurrentInputs(nextInputs);
    void prepareRequestData(nextInputs, {
      forceReset: true,
      respectTouched: false,
      scopes: ["all"],
    });
  }, [
    api,
    requestViewMode,
    prepareRequestData,
    adoptInputsBaseline,
    setSelectedExampleIdx,
    setCurrentInputs,
  ]);

  // Based on the displayed URL (not resolved inputs/env)
  const isDisplayedUrlWebSocket = (protocol: Protocol | undefined, url: string | undefined
  ): boolean => {
    return protocolResolver.getEffectiveProtocol(protocol, url) === "ws";
  };

  // Peer fields read from YAML (`api`); requestData is for Send resolution / body preview.
  const isGraphQL = (requestData?.protocol ?? api.protocol) === "graphql";
  const isGrpc = (requestData?.protocol ?? api.protocol) === "grpc";
  const requestProtocol = requestData?.protocol || api.protocol;
  const peerUrl = useMemo(
    () => yamlValueToInputBoxWithTokens(sessionApi.url, true, true),
    [sessionApi.url],
  );
  // Tokens mode: authored query (incl. omit). Resolved/sandbox: post-strip
  // requestData so omitted params disappear from the URL the same way they leave Send.
  const urlQuery = useMemo(() => {
    if (bodyTokenMode === "resolved") {
      if (requestData?.query && typeof requestData.query === "object") {
        return queryForUrlBar(requestData.query as Record<string, unknown>);
      }
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(sessionApi.query ?? {})) {
        if (!leafResolvesToOmit(value, bodyValueContext)) {
          filtered[key] = value;
        }
      }
      return queryForUrlBar(filtered);
    }
    return queryForUrlBar(sessionApi.query as Record<string, unknown> | undefined);
  }, [
    sessionApi.query,
    bodyTokenMode,
    bodyValueContext,
    requestData?.query,
  ]);
  const peerGraphqlOperation = useMemo(
    () => yamlValueToInputBoxWithTokens(sessionApi.graphql?.operation, true, true),
    [sessionApi.graphql?.operation],
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
    requestData?.protocol || sessionApi.protocol,
    sessionApi.url,
  );
  const methodOrProtocolValue = (effectiveProtocol === "ws" || effectiveProtocol === "graphql" || effectiveProtocol === "grpc")
    ? `protocol:${effectiveProtocol}`
    : `method:${resolveApiHttpMethod(
        requestData?.method || sessionApi.method,
        requestData?.body ?? sessionApi.body).toLowerCase()}`;
  const methodOrProtocolKey = methodOrProtocolValue.startsWith("protocol:")
    ? methodOrProtocolValue.slice("protocol:".length)
    : methodOrProtocolValue.slice("method:".length);
  const currentRequestFormat = requestFormat(sessionApi.format);
  const currentResponseFormat = responseFormat(sessionApi.format);
  const resolvedRequestFormat = resolveRequestFormat(
    currentRequestFormat,
    sessionApi.headers as Record<string, string> | undefined,
    methodOrProtocolValue.startsWith("method:") ? methodOrProtocolKey : undefined,
  );
  // Resolved preview shows substituted i:/e:/r:/c: values. Token mode uses a
  // separate BodyView with {{…}} markers (own Ctrl+Z stack).
  // Omit leaves are already dropped by resolveApiRequest → requestData.body.
  // After Send, requestData holds the reminted snapshot that was sent.
  const requestBodyDisplay = useMemo(() => {
    return displayRequestBody(
      requestData?.body ?? sessionApi.body ?? "",
      resolvedRequestFormat,
      { valueContext: bodyValueContext },
    );
  }, [
    requestData?.body,
    sessionApi.body,
    resolvedRequestFormat,
    bodyValueContext,
  ]);

  const onUrlChange = useCallback((newUrl: string) => {
    const next = isSandbox ? newUrl : stringFieldToYamlWithLiveTokens(newUrl);
    updateSession({ url: next });
  }, [updateSession, isSandbox]);

  // Query, cookies, and headers keep YAML types. The URL bar is a string view
  // of that same query.
  const onQueryChange = useCallback((query: JSONRecord) => {
    updateSession({ query: query as APIData["query"] });
  }, [updateSession]);

  const onUrlQueryChange = useCallback((query: Record<string, string>) => {
    const next = queryFromUrlBar(query);
    // Resolved URL omits omit-params; put authored omit keys back so a URL
    // edit does not delete them from YAML (skip in sandbox — literals only).
    if (bodyTokenMode === "resolved" && !isSandbox) {
      for (const [key, value] of Object.entries(sessionApi.query ?? {})) {
        if (leafResolvesToOmit(value, bodyValueContext) &&
            !Object.prototype.hasOwnProperty.call(next, key)) {
          next[key] = value as JSONValue;
        }
      }
    }
    onQueryChange(next);
  }, [sessionApi.query, bodyTokenMode, bodyValueContext, isSandbox, onQueryChange]);

  const onHeadersChange = useCallback((headers: JSONRecord) => {
    updateSession({ headers: headers as APIData["headers"] });
  }, [updateSession]);

  const onCookiesChange = useCallback((cookies: JSONRecord) => {
    updateSession({ cookies: cookies as APIData["cookies"] });
  }, [updateSession]);

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
  const requestPaneRatiosRef = useRef({
    stacked: DEFAULT_REQUEST_PANE_RATIO,
    sideBySide: DEFAULT_REQUEST_PANE_RATIO,
  });
  const [requestPaneSize, setRequestPaneSize] = useState(200);
  const [requestResponseLayout, setRequestResponseLayout] =
    useState<RequestResponseLayout>(() => {
      return localStorage.getItem(REQUEST_RESPONSE_LAYOUT_KEY) === "side-by-side"
        ? "side-by-side"
        : "stacked";
    });

  useEffect(() => {
    const stackedRatio = Number(localStorage.getItem(REQUEST_PANE_RATIO_KEY));
    if (Number.isFinite(stackedRatio) && stackedRatio >= MIN_REQUEST_PANE_RATIO && stackedRatio <= MAX_REQUEST_PANE_RATIO) {
      requestPaneRatiosRef.current.stacked = stackedRatio;
    }
    const sideBySideRatio = Number(localStorage.getItem(SIDE_BY_SIDE_PANE_RATIO_KEY));
    if (Number.isFinite(sideBySideRatio) && sideBySideRatio >= MIN_REQUEST_PANE_RATIO && sideBySideRatio <= MAX_REQUEST_PANE_RATIO) {
      requestPaneRatiosRef.current.sideBySide = sideBySideRatio;
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const syncFromRatio = () => {
      const isStacked = requestResponseLayout === "stacked";
      const length = isStacked ? el.clientHeight : el.clientWidth;
      if (length <= 0) {
        return;
      }
      const ratio = isStacked
        ? requestPaneRatiosRef.current.stacked
        : requestPaneRatiosRef.current.sideBySide;
      setRequestPaneSize(Math.floor(length * ratio));
    };
    syncFromRatio();
    const observer = new ResizeObserver(syncFromRatio);
    observer.observe(el);
    return () => observer.disconnect();
  }, [requestResponseLayout]);

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
    const isStacked = requestResponseLayout === "stacked";
    const length = isStacked
      ? contentRef.current?.clientHeight ?? 0
      : contentRef.current?.clientWidth ?? 0;
    if (length > 0) {
      const ratio = Math.min(
        MAX_REQUEST_PANE_RATIO,
        Math.max(MIN_REQUEST_PANE_RATIO, size / length),
      );
      if (isStacked) {
        requestPaneRatiosRef.current.stacked = ratio;
        localStorage.setItem(REQUEST_PANE_RATIO_KEY, String(ratio));
      } else {
        requestPaneRatiosRef.current.sideBySide = ratio;
        localStorage.setItem(SIDE_BY_SIDE_PANE_RATIO_KEY, String(ratio));
      }
    }
    setRequestPaneSize(size);
  };

  const toggleRequestResponseLayout = () => {
    const nextLayout = requestResponseLayout === "stacked" ? "side-by-side" : "stacked";
    setRequestResponseLayout(nextLayout);
    localStorage.setItem(REQUEST_RESPONSE_LAYOUT_KEY, nextLayout);
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
      updateSession({ protocol });
      if (protocol === "graphql" || protocol === "grpc") {
        setEditorTab(protocol);
      } else if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
      return;
    }
    if (raw.startsWith("method:")) {
      const method = raw.slice("method:".length) as Method;
      updateSession({ method, protocol: "http" });
      if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
    }
  };

  const shouldShowBody = () => editorTab === "body";
  const shouldShowResponse = () => responseTab === "body";

  const canExtractOutput = Boolean(responseData) &&
    responseTab === "body" &&
    Boolean(responseBodyToolbar?.canInspect);
  const extractTitle = responseTab === "body"
    ? "Place the cursor on a response value to extract it"
    : "Extract output";
  const extractOutput = () => {
    if (responseTab === "body") {
      responseBodyToolbar?.inspect();
    }
  };
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
    updateSession({ format: result.format });
    // text bodies are always plain storage.
    if (side === "request" && format === "text" && isStructuredYamlBody(sessionApi.body)) {
      const asText = formatBody("text", sessionApi.body ?? "");
      setBodyYamlEncodedManual(false);
      setBodyYamlEncodeError(false);
      updateSession({ body: valueForYamlSave(asText) as APIData["body"] });
    }
  };

  // Resolved preview vs token editor. The mirror toggle switches between them.
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
  const bodyEditYamlEncoded = isStructuredYamlBody(sessionApi.body);

  useEffect(() => {
    const structured = requestData?.body ?? sessionApi.body;
    if (structured != null && typeof structured !== "string") {
      resolvedBodyHintRef.current = structured;
    }
  }, [requestData?.body, sessionApi.body]);

  const tokensTextFromYaml = useCallback(() => {
    const resolvedHint = typeof requestData?.body === "string"
      ? resolvedBodyHintRef.current
      : (requestData?.body ?? resolvedBodyHintRef.current);
    // Peer: YAML → tokens (never from resolved values).
    return yamlBodyToTokensText(
      sessionApi.body,
      resolvedRequestFormat,
      bodyValueContext,
      resolvedHint,
    );
  }, [sessionApi.body, requestData?.body, resolvedRequestFormat, bodyValueContext]);

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
    setRequestViewMode("edit");
  }, [tokensTextFromYaml]);

  /**
   * Peer write: tokens/display text → YAML body (immediate).
   * Resolved values never flow into YAML — only token text (draft or yaml→tokens).
   */
  const writeBodyStorage = useCallback((
    text: string,
    preferEncoded: boolean,
    format = resolvedRequestFormat,
  ): boolean => {
    // Own write → ignore the following api.body echo (do not rewrite draft).
    skipBodySyncRef.current = true;
    const nextBody = tokensTextToYamlBody(
      text,
      format,
      preferEncoded,
    ) as APIData["body"];
    const encodedOk = preferEncoded && isStructuredYamlBody(nextBody);
    setBodyYamlEncodeError(preferEncoded && !encodedOk);
    updateSession({ body: nextBody });
    return !preferEncoded || encodedOk;
  }, [updateSession, resolvedRequestFormat]);

  const handleBodyEditChange = useCallback((val: string) => {
    setBodyEditDraft(val);
    writeBodyStorage(val, bodyYamlEncodedManual);
  }, [bodyYamlEncodedManual, writeBodyStorage]);

  const handleSandboxBodyChange = useCallback((val: string) => {
    updateSession({ body: val });
  }, [updateSession]);

  /** Raw/YAML-encoded menu choice — independent of resolved/token display. */
  const handleBodyEditYamlEncoded = useCallback((
    enabled: boolean,
    format = resolvedRequestFormat,
  ) => {
    setBodyYamlEncodedManual(enabled);
    if (format === "text") {
      setBodyYamlEncodeError(false);
      return;
    }
    const currentText = bodyTokenMode === "tokens" ? bodyEditDraft : bodyTextForStorage();
    const selection = selectBodyFormatStorage({
      body: sessionApi.body,
      currentText,
      sourceFormat: resolvedRequestFormat,
      targetFormat: format,
      storageMode: enabled ? "encoded" : "plain",
      valueContext: bodyValueContext,
      resolvedHint: resolvedBodyHintRef.current,
    });
    setBodyEditDraft(selection.editText);
    setBodyYamlEncodeError(selection.encodingFailed);
    if (selection.encodingFailed) {
      return;
    }
    if (selection.bodyChanged) {
      skipBodySyncRef.current = true;
      updateSession({ body: selection.body as APIData["body"] });
    }
  }, [
    sessionApi.body,
    bodyTokenMode,
    bodyEditDraft,
    bodyTextForStorage,
    resolvedRequestFormat,
    bodyValueContext,
    updateSession,
  ]);

  // External YAML edits (left pane) while in tokens mode → refresh draft only.
  // Do not bump bodyEditSession (that remounts Monaco and feels like a reload).
  // Do not touch bodyYamlEncodedManual — preference survives temporary plain fallback.
  useEffect(() => {
    if (bodyTokenMode !== "tokens" || isSandbox) {
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
  }, [sessionApi.body, bodyTokenMode, isSandbox, tokensTextFromYaml]);

  // Prefer-encoded: when body is temporarily plain (invalid mid-edit or YAML tweak)
  // but the text packs again, snap back to structured storage.
  useEffect(() => {
    if (!bodyPackReadyRef.current) {
      bodyPackReadyRef.current = true;
      return;
    }
    if (!bodyYamlEncodedManual) {
      return;
    }
    if (isSandbox) {
      return;
    }
    if (isStructuredYamlBody(sessionApi.body)) {
      setBodyYamlEncodeError(false);
      return;
    }
    if (typeof sessionApi.body !== "string" || sessionApi.body.trim() === "") {
      return;
    }
    if (skipBodySyncRef.current) {
      return;
    }
    const packed = packBodyAsYamlEncoded(sessionApi.body, resolvedRequestFormat);
    if (packed == null) {
      setBodyYamlEncodeError(true);
      return;
    }
    skipBodySyncRef.current = true;
    setBodyYamlEncodeError(false);
    updateSession({ body: packed as APIData["body"] });
  }, [
    sessionApi.body,
    bodyYamlEncodedManual,
    resolvedRequestFormat,
    updateSession,
    isSandbox,
  ]);

  // If a self-write did not change api.body, the sync effect never runs — clear skip.
  useEffect(() => {
    if (!skipBodySyncRef.current) {
      return;
    }
    const t = setTimeout(() => {
      skipBodySyncRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [sessionApi.body, bodyEditDraft]);

  const enterSandbox = useCallback(async (source: APIData) => {
    const clone = cloneApiData(source);
    sandboxRuntimeSnapshotRef.current = {
      inputs: cloneInputs(currentInputs),
      exampleIdx: selectedExampleIdx,
      dirtyKeys: Array.from(dirtyInputKeys),
      baseline: cloneInputs(inputsBaselineRef.current),
    };
    flushSync(() => {
      setSandboxApi(clone);
      setRequestViewMode("sandbox");
      setRequestUiEpoch((n) => n + 1);
      setEditTitle(false);
      setEditTags(false);
      setEditDescription(false);
      setEditInputsDecl(false);
      setEditOutputsDecl(false);
      setEditSetenvDecl(false);
    });
    // Align sync ref so the YAML-watch effect does not immediately re-seed.
    sandboxYamlSyncRef.current = source;
    await prepareRequestData(undefined, {
      forceReset: true,
      respectTouched: false,
      scopes: ["all"],
      refreshRuntimeTokens: true,
    });
  }, [prepareRequestData, currentInputs, selectedExampleIdx, dirtyInputKeys]);

  const leaveSandbox = useCallback(async (next: "edit" | "telescope") => {
    // Drop the whole isolated session — no merge back into YAML.
    const snap = sandboxRuntimeSnapshotRef.current;
    sandboxRuntimeSnapshotRef.current = null;
    flushSync(() => {
      setSandboxApi(null);
      setRequestViewMode(next);
      setRequestUiEpoch((n) => n + 1);
    });
    // Re-apply pre-sandbox runtime inputs AFTER the session switch. The hook's
    // api-change effect may have already reset inputs to YAML defaults.
    if (snap) {
      flushSync(() => {
        setSelectedExampleIdx(snap.exampleIdx);
        setCurrentInputs(cloneInputs(snap.inputs));
        setDirtyInputKeys(new Set(snap.dirtyKeys));
        inputsBaselineRef.current = cloneInputs(snap.baseline);
        baselineExampleIdxRef.current = snap.exampleIdx;
      });
    }
    discardRequestScratch();
    await prepareRequestData(
      snap ? cloneInputs(snap.inputs) : undefined,
      {
        forceReset: true,
        respectTouched: false,
        scopes: ["all"],
        refreshRuntimeTokens: true,
      },
    );
    if (next === "edit") {
      openBodyTokens();
    }
  }, [
    discardRequestScratch,
    prepareRequestData,
    openBodyTokens,
    setSelectedExampleIdx,
    setCurrentInputs,
  ]);

  const handleRequestViewModeChange = useCallback(async (mode: RequestViewMode) => {
    if (mode === requestViewMode) {
      return;
    }

    if (requestViewMode === "sandbox" && mode !== "sandbox") {
      await leaveSandbox(mode === "edit" ? "edit" : "telescope");
      return;
    }

    if (mode === "edit") {
      openBodyTokens();
      return;
    }

    if (mode === "telescope") {
      if (requestViewMode === "edit") {
        writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
      }
      await prepareRequestData(undefined, {
        respectTouched: false,
        scopes: ["all"],
        refreshRuntimeTokens: true,
      });
      setRequestViewMode("telescope");
      return;
    }

    // Enter sandbox: fresh clone of the current YAML buffer.
    if (requestViewMode === "edit") {
      writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
    }
    await enterSandbox(api);
  }, [
    requestViewMode,
    openBodyTokens,
    writeBodyStorage,
    bodyEditDraft,
    bodyYamlEncodedManual,
    prepareRequestData,
    leaveSandbox,
    enterSandbox,
    api,
  ]);

  const sendWithResolvedBody = useCallback(async () => {
    if (bodyTokenMode === "tokens" && !isSandbox) {
      // Commit token draft into YAML before Send (Send runs the YAML model).
      flushSync(() => {
        writeBodyStorage(bodyEditDraft, bodyYamlEncodedManual);
      });
    }
    // Send remints r:/c: (or uses sandbox requestData) then sends those values.
    await handleSend();
  }, [
    bodyTokenMode,
    isSandbox,
    bodyEditDraft,
    bodyYamlEncodedManual,
    writeBodyStorage,
    handleSend,
  ]);

  const sendShortcutEnabled =
    (!yamlErrors || yamlErrors.length === 0) && !(isWsUrl && !network.connected);
  usePrimaryAction(sendShortcutEnabled ? sendWithResolvedBody : null);

  const requestInFlight = isSending || network.loading;
  useEffect(() => {
    if (!requestInFlight) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.isComposing) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void handleCancel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [requestInFlight, handleCancel]);

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
    const nextInputs = adoptInputsBaseline(baseInputs, newIdx);
    setCurrentInputs(nextInputs);
    prepareRequestData(nextInputs, { respectTouched: false, forceReset: true });
  }, [
    api.inputs,
    examples,
    prepareRequestData,
    setCurrentInputs,
    setSelectedExampleIdx,
    adoptInputsBaseline,
  ]);

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
    setDirtyInputKeys(computeDirtyInputKeys(data, inputsBaselineRef.current));
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
      updateSession({ examples: nextExamples });
      return;
    }
    const match = findMatchingExampleIndex(examples, data);
    if (match !== selectedExampleIdx) {
      setSelectedExampleIdx(match);
    }
  };

  const handleResetInputKey = (key: string) => {
    const next = restoreInputKeyFromBaseline(
      currentInputs,
      inputsBaselineRef.current,
      key,
    );
    handleInputsChange(next);
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

    const updatedExamples = [...(sessionApi.examples || []), newExample];
    updateSession({ examples: updatedExamples });
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

  // Keep/warm only request+response data tabs — not Doc / Auth / Settings.
  const requestTabIds = useMemo(
    () => requestOverflowTabs
      .map(tab => tab.id)
      .filter((id): id is EditorTab => (
        id !== "doc" && id !== "auth" && id !== "settings"
      )),
    [requestOverflowTabs],
  );
  const responseTabIds = useMemo(
    () => responseOverflowTabs.map(tab => tab.id),
    [responseOverflowTabs],
  );
  const keepEditorTab = useKeptTabs(editorTab, requestTabIds, mmtFilePath || "");
  const keepResponseTab = useKeptTabs(responseTab, responseTabIds, mmtFilePath || "");

  return (
    <TokenModeContext.Provider value={tokenModeState}>
    <div className={[
      "apitest-root",
      selector ? "apitest-root--source" : "",
      requestResponseLayout === "side-by-side" ? "apitest-root--side-by-side" : "",
      isSandbox ? "apitest-root--sandbox" : "",
    ].filter(Boolean).join(" ")}>
      {/* ── Fixed header: URL bar + Send ── */}
      <div className="apitest-fixed-header">
      <div className="apitest-url-row" style={methodChromeVars as React.CSSProperties}>
        {selector}
        <MethodUrlBar
          key={`url-${requestUiEpoch}`}
          methodValue={methodOrProtocolValue}
          onMethodChange={handleMethodOrProtocolChange}
          url={peerUrl}
          query={urlQuery}
          onUrlChange={onUrlChange}
          onQueryChange={onUrlQueryChange}
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
        split={requestResponseLayout === "stacked" ? "horizontal" : "vertical"}
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
              <BodyViewValidationIndicator toolbar={requestBodyToolbar} />
              <BodyFormatBar
                value={currentRequestFormat}
                storageMode={bodyEditYamlEncoded
                  || (bodyYamlEncodeError && bodyYamlEncodedManual)
                  ? "encoded"
                  : "plain"}
                encodeError={bodyYamlEncodeError
                  && resolvedRequestFormat !== "none"
                  && resolvedRequestFormat !== "text"
                  && resolvedRequestFormat !== "binary"
                  && resolvedRequestFormat !== "multipart"}
                onChange={(format, storageMode) => {
                  setBodyFormat("request", format);
                  if (storageMode && format !== "auto") {
                    handleBodyEditYamlEncoded(storageMode === "encoded", format);
                  }
                }}
              />
            </div>
        </div>
        <span
          className={`apitest-tabs-tools-divider${shouldShowBody() ? "" : " is-hidden"}`}
          aria-hidden
        />
        <RequestModeDrawer
          mode={requestViewMode}
          onChange={(mode) => { void handleRequestViewModeChange(mode); }}
        />
        <button
          type="button"
          className="button-icon no-shrink section-edit-toggle apitest-header-tool-btn"
          onClick={() => showEnvironmentPanel()}
          title="Show Environment Variables"
          aria-label="Show Environment Variables"
        >
          <span className="codicon codicon-globe" aria-hidden />
        </button>
      </div>
      <FadePane paneKey={editorTab} className="apitest-pane-fill" durationMs={100}>

      {editorTab === "doc" && (
        <KeptTabPanel key="doc" active>
        <div className="apitest-section apitest-section--doc panel-form">
          <div className="panel-form-row">
            <SectionEditLabel
              label="Title"
              editing={editTitle}
              onEdit={() => setEditTitle(true)}
              hideEdit={isSandbox}
            />
            {editTitle && !isSandbox ? (
              <div>
                <StableTextInput
                  value={sessionApi.title || ""}
                  onChange={next => updateSession({ title: next })}
                  placeholder="title"
                  disabled={!onUpdateApi && !isSandbox}
                />
                <SectionEditDone onDone={() => setEditTitle(false)} />
              </div>
            ) : (
              <div className={sessionApi.title ? "apitest-doc-plain" : "apitest-empty"}>
                {sessionApi.title || "No title"}
              </div>
            )}
          </div>

          <div className="panel-form-row">
            <SectionEditLabel
              label="Tags"
              editing={editTags}
              onEdit={() => setEditTags(true)}
              hideEdit={isSandbox}
            />
            {editTags && !isSandbox ? (
              <div>
                <SearchableTagInput
                  tags={safeList(sessionApi.tags)}
                  onChange={tags => updateSession({ tags })}
                  suggestions={["security", "sessionless", "api", "user", "admin"]}
                />
                <SectionEditDone onDone={() => setEditTags(false)} />
              </div>
            ) : safeList(sessionApi.tags).length > 0 ? (
              <div className="apitest-doc-plain">
                {safeList(sessionApi.tags).join(", ")}
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
              hideEdit={isSandbox}
            />
            {editDescription && !isSandbox ? (
              <div>
                <DescriptionEditor
                  value={sessionApi.description || ""}
                  onChange={value => updateSession({ description: value })}
                />
                <SectionEditDone onDone={() => setEditDescription(false)} />
              </div>
            ) : sessionApi.description ? (
              <MdViewer
                description={sessionApi.description}
                inputs={sessionApi.inputs}
                outputs={sessionApi.outputs}
                showDescriptionLabel={false}
              />
            ) : (
              <div className="apitest-empty">No description available.</div>
            )}
          </div>
        </div>
        </KeptTabPanel>
      )}

      {editorTab === "settings" && (
        <KeptTabPanel key="settings" active>
        <div className="apitest-section apitest-section--settings">
          {onUpdateApi && !isSandbox ? (
            <ApiSettingsEditor
              key={`settings-${requestUiEpoch}`}
              api={sessionApi}
              update={updateSession}
            />
          ) : (
            <div className="apitest-empty">
              {isSandbox ? "Settings are not editable in sandbox." : "Settings are read-only."}
            </div>
          )}
        </div>
        </KeptTabPanel>
      )}

      {editorTab === "auth" && (
        <KeptTabPanel key="auth" active>
        <div className="apitest-section apitest-section--auth">
          {onUpdateApi && !isSandbox ? (
            <ApiAuthEditor
              key={`auth-${requestUiEpoch}`}
              api={sessionApi}
              update={updateSession}
              valueContext={bodyValueContext}
            />
          ) : (
            <div className="apitest-empty">
              {isSandbox ? "Auth is not editable in sandbox." : "Auth is read-only."}
            </div>
          )}
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("params") && (
        <KeptTabPanel key="params" active={editorTab === "params"}>
        <div className="apitest-section">
        <KSVEditor
          key={`query-${requestUiEpoch}`}
          label=""
          value={sessionApi.query}
          onChange={onQueryChange}
          canContainToken
          typedValues
          liveAngleTokens={!isSandbox}
          valueContext={bodyValueContext}
          tokenCacheNamespace="query"
          hideOmittedWhenResolved
        />
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("headers") && (
        <KeptTabPanel key="headers" active={editorTab === "headers"}>
        <div className="apitest-section">
        <KSVEditor
          key={`headers-${requestUiEpoch}`}
          label=""
          value={sessionApi.headers}
          onChange={onHeadersChange}
          canContainToken
          typedValues
          liveAngleTokens={!isSandbox}
          valueContext={bodyValueContext}
          tokenCacheNamespace="headers"
          hideOmittedWhenResolved
        />
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("cookies") && (
        <KeptTabPanel key="cookies" active={editorTab === "cookies"}>
        <div className="apitest-section">
        <KSVEditor
          key={`cookies-${requestUiEpoch}`}
          label=""
          value={sessionApi.cookies}
          onChange={onCookiesChange}
          canContainToken
          typedValues
          liveAngleTokens={!isSandbox}
          valueContext={bodyValueContext}
          tokenCacheNamespace="cookies"
          hideOmittedWhenResolved
        />
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("body") && (
        <KeptTabPanel key="body" active={editorTab === "body"}>
        <div className="apitest-section">
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
                    value={yamlValueToInputBoxWithTokens(
                      typeof sessionApi.body === "string" ? sessionApi.body : "",
                      true,
                      true,
                    )}
                    basePath={mmtFilePath}
                    showFilePicker
                    placeholder="Relative path to binary file"
                    canContainToken
                    valueContext={bodyValueContext}
                    onChange={val => updateSession({
                      body: isSandbox ? val : stringFieldToYamlWithLiveTokens(val),
                    })}
                    onEnterPressed={val => updateSession({
                      body: isSandbox ? val : stringFieldToYamlWithLiveTokens(val),
                    })}
                  />
                ) : resolvedRequestFormat === "multipart" ? (
                  <MultipartPartsEditor
                    value={sessionApi.body}
                    onChange={parts => updateSession({ body: parts as APIData["body"] })}
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
                    // Pair YAML tokens with last Send/open snapshot so hover
                    // tips match the wire even while telescope is off.
                    tokenSource={sessionApi.body}
                    resolvedBody={requestData?.body}
                    onToolbarChange={setRequestBodyToolbar}
                  />
                ) : isSandbox ? (
                  <BodyView
                    key={`body-sandbox-${requestUiEpoch}`}
                    value={requestBodyDisplay}
                    format={resolvedRequestFormat}
                    mode="live"
                    onChange={handleSandboxBodyChange}
                    valueContext={bodyValueContext}
                    resolvedBody={requestData?.body ?? sessionApi.body}
                    onToolbarChange={setRequestBodyToolbar}
                  />
                ) : (
                  <BodyView
                    key={`body-resolved-${requestUiEpoch}`}
                    value={requestBodyDisplay}
                    format={resolvedRequestFormat}
                    mode="live"
                    onStartEdit={openBodyTokens}
                    valueContext={bodyValueContext}
                    tokenTemplate={tokensTextFromYaml()}
                    tokenSource={sessionApi.body}
                    resolvedBody={requestData?.body ?? sessionApi.body}
                    onToolbarChange={setRequestBodyToolbar}
                  />
                )}              </div>
            )}
          </div>
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("graphql") && (
        <KeptTabPanel key="graphql" active={editorTab === "graphql"}>
        <div className="apitest-section">
            <div className="label apitest-graphql-operation-header">
              Operation
            </div>
            <div className="apitest-body-wrapper">
              <BodyView
                key={`graphql-op-${requestUiEpoch}`}
                value={peerGraphqlOperation}
                format="graphql"
                mode="live"
                onChange={val => {
                  updateSession({
                    graphql: {
                      operation: isSandbox
                        ? val
                        : stringFieldToYamlWithLiveTokens(val),
                      operationName: sessionApi.graphql?.operationName,
                      variables: sessionApi.graphql?.variables,
                    },
                  });
                }}
              />
            </div>
            <KSVEditor
              key={`graphql-vars-${requestUiEpoch}`}
              label="Variables"
              value={sessionApi.graphql?.variables}
              canContainToken
              typedValues
              liveAngleTokens={!isSandbox}
              valueContext={bodyValueContext}
              onChange={variables => {
                updateSession({
                  graphql: {
                    operation: sessionApi.graphql?.operation ?? "",
                    operationName: sessionApi.graphql?.operationName,
                    variables,
                  },
                });
              }}
            />
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("grpc") && (
        <KeptTabPanel key="grpc" active={editorTab === "grpc"}>
        <div className="apitest-section">
            <div className="field-inline is-gap is-spaced">
              <div className="field-grow">
                <div className="label">Service</div>
                <StableTextInput
                  type="text"
                  placeholder="package.ServiceName"
                  value={sessionApi.grpc?.service || ""}
                  onChange={next => {
                    updateSession({
                      grpc: {
                        proto: sessionApi.grpc?.proto,
                        service: next,
                        method: sessionApi.grpc?.method ?? "",
                        message: sessionApi.grpc?.message,
                        stream: sessionApi.grpc?.stream,
                      },
                    });
                  }}
                  className="mmt-fill"
                />
              </div>
              <div className="field-grow">
                <div className="label">Method</div>
                <StableTextInput
                  type="text"
                  placeholder="MethodName"
                  value={sessionApi.grpc?.method || ""}
                  onChange={next => {
                    updateSession({
                      grpc: {
                        proto: sessionApi.grpc?.proto,
                        service: sessionApi.grpc?.service ?? "",
                        method: next,
                        message: sessionApi.grpc?.message,
                        stream: sessionApi.grpc?.stream,
                      },
                    });
                  }}
                  className="mmt-fill"
                />
              </div>
            </div>
            <KSVEditor
              key={`grpc-msg-${requestUiEpoch}`}
              label="Message"
              value={sessionApi.grpc?.message as JSONRecord | undefined}
              canContainToken
              typedValues
              liveAngleTokens={!isSandbox}
              valueContext={bodyValueContext}
              onChange={msg => {
                updateSession({
                  grpc: {
                    proto: sessionApi.grpc?.proto,
                    service: sessionApi.grpc?.service ?? "",
                    method: sessionApi.grpc?.method ?? "",
                    message: msg,
                    stream: sessionApi.grpc?.stream,
                  },
                });
              }}
            />
        </div>
        </KeptTabPanel>
      )}

      {keepEditorTab("inputs") && (
        <KeptTabPanel key="inputs" active={editorTab === "inputs"}>
        <div className="apitest-section">
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
              hideEdit={isSandbox}
            />
            {editInputsDecl && !isSandbox ? (
              <div>
                <KVEditor
                  label=""
                  value={sessionApi.inputs}
                  onChange={kv => updateSession({ inputs: kv })}
                  keyPlaceholder="name"
                  valuePlaceholder="value"
                  canContainToken
                  liveAngleTokens
                  valueContext={bodyValueContext}
                  disabled={!onUpdateApi && !isSandbox}
                />
                <SectionEditDone onDone={() => setEditInputsDecl(false)} />
              </div>
            ) : (
              <VEditor
                key={`inputs-${requestUiEpoch}`}
                label=""
                value={currentInputs}
                onChange={handleInputsChange}
                keyOptions={
                  typeof sessionApi.inputs === "object"
                    ? Object.keys(sessionApi.inputs || {})
                    : []
                }
                inputConstraints={inputConstraints}
                deletable={false}
                canContainToken
                liveAngleTokens
                valueContext={bodyValueContext}
                dirtyKeys={selectedExampleIdx === -1 ? dirtyInputKeys : undefined}
                onResetKey={selectedExampleIdx === -1 ? handleResetInputKey : undefined}
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
                  updateSession({ examples: nextExamples });
                }}
              />
            ) : null}
        </div>
        </KeptTabPanel>
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
                bodyToolbar={responseBodyToolbar}
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
          {responseData ? <span className="apitest-tabs-tools-divider" aria-hidden /> : null}
          <div className="bodyview-header-actions">
            {responseTab === "body" ? (
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              disabled={!canExtractOutput}
              onMouseDown={event => event.preventDefault()}
              onClick={extractOutput}
              title={extractTitle}
              aria-label="Extract output"
            >
              <span className="codicon codicon-sign-out" aria-hidden />
            </button>
            ) : null}
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              onClick={clearResponse}
              disabled={!responseData}
              title="Clear response"
              aria-label="Clear response"
            >
              <span className="codicon codicon-eraser" aria-hidden />
            </button>
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              onClick={() => showHistoryPanel()}
              title="Show History Panel"
              aria-label="Show History Panel"
            >
              <span className="codicon codicon-history" aria-hidden />
            </button>
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              onClick={toggleRequestResponseLayout}
              title={requestResponseLayout === "stacked"
                ? "Switch to side-by-side request and response"
                : "Switch to stacked request and response"}
              aria-label={requestResponseLayout === "stacked"
                ? "Switch to side-by-side request and response"
                : "Switch to stacked request and response"}
              aria-pressed={requestResponseLayout === "side-by-side"}
            >
              <span
                className={`codicon ${
                  requestResponseLayout === "stacked"
                    ? "codicon-split-horizontal"
                    : "codicon-split-vertical"
                }`}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>
      <div className="apitest-pane-fill">
      <FadePane paneKey={responseTab} className="apitest-pane-fill" durationMs={100}>
        {keepResponseTab("outputs") && (
          <KeptTabPanel key="outputs" active={responseTab === "outputs"}>
          <div className="apitest-section">
            <SectionEditLabel
              label="Outputs"
              editing={editOutputsDecl}
              onEdit={() => setEditOutputsDecl(true)}
              hideEdit={isSandbox}
            />
            {editOutputsDecl && !isSandbox ? (
              <div>
                <KSVEditor
                  label=""
                  value={api.outputs}
                  onChange={kv => updateSession({ outputs: kv })}
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
              hideEdit={isSandbox}
            />
            {editSetenvDecl && !isSandbox ? (
              <div>
                <KSVEditor
                  label=""
                  value={api.setenv}
                  onChange={kv => updateSession({ setenv: kv })}
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
          </div>
          </KeptTabPanel>
        )}

        {keepResponseTab("headers") && (
          <KeptTabPanel key="resp-headers" active={responseTab === "headers"}>
          <div className="apitest-section">
          {responseData && countNamedEntries(responseData.headers) > 0 ? (
            <KSVEditor
              label=""
              value={responseData.headers || {}}
              onChange={() => { }}
              deactivated={true}
              onExtractRow={key => handleAddOutputExpression(`headers.${key}`, key)}
            />
          ) : (
            <div className="apitest-empty">No response headers.</div>
          )}
          </div>
          </KeptTabPanel>
        )}

        {keepResponseTab("cookies") && (
          <KeptTabPanel key="resp-cookies" active={responseTab === "cookies"}>
          <div className="apitest-section">
          {responseData && countNamedEntries(responseData.cookies) > 0 ? (
            <KSVEditor
              label=""
              value={responseData.cookies || {}}
              onChange={() => { }}
              deactivated={true}
              onExtractRow={key => handleAddOutputExpression(`cookies.${key}`, key)}
            />
          ) : (
            <div className="apitest-empty">No response cookies.</div>
          )}
          </div>
          </KeptTabPanel>
        )}

        {/* Keep BodyView mounted (empty) under the idle/sending overlay so the
            first response does not pay Monaco cold-start; also kept across tab switches. */}
        {keepResponseTab("body") && (
          <KeptTabPanel key="resp-body" active={responseTab === "body"}>
          <div className="apitest-section">
          <div className="apitest-body-pane">
            <div className="apitest-body-wrapper">
              <ResponseBodyContent
                display={responseDisplay}
                refreshKey={responseRevision}
                requestUrl={requestData?.url}
                onInspectPosition={handleAddOutputVariable}
                onToolbarChange={setResponseBodyToolbar}
              />
            </div>
          </div>
          </div>
          </KeptTabPanel>
        )}
      </FadePane>
      {(requestInFlight || (!responseData && responseTab !== "outputs")) ? (
        <NoResponseYet
          onSend={sendWithResolvedBody}
          onCancel={handleCancel}
          sending={requestInFlight}
          dimmed={Boolean(responseData) && requestInFlight}
        />
      ) : null}
      </div>
      </div>
      </SplitPane>
      </div>
    </div>
    </TokenModeContext.Provider>
  );
};

export default APITest;
