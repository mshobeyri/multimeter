import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { extractInputConstraintsFromDescription } from "mmt-core/paramConstraints";
import { APIData, exampleExpect, exampleId, exampleTitle } from "mmt-core/APIData";
import { JSONRecord, Method, Protocol, RequestFormat, ResponseFormat, requestFormat, responseFormat } from "mmt-core/CommonData";
import { resolveRequestFormat } from "mmt-core/formatResolve";
import { Request } from "mmt-core/NetworkData";
import KSVEditor from "../components/KSVEditor";
import BodyView, { type BodyViewCursor } from "../components/BodyView";
import FilePickerInput from "../components/FilePickerInput";
import MultipartPartsEditor from "../components/MultipartPartsEditor";
import {
  bodyForYamlSave,
  displayRequestBody,
  displayRequestStringRecord,
  displayRuntimeString,
  enterEditStringBuffer,
  enterEditStringRecord,
  headersTokenSource,
  packBodyAsYamlEncoded,
  queryTokenSource,
  tokensTextToYamlBody,
  valueForYamlSave,
  yamlBodyToTokensText,
} from "mmt-core/apiBodyEdit";
import { resolveApiRequest } from "mmt-core/resolveApiRequest";
import { normalizeNewlines } from "mmt-core/textLines";
import { applyFormatSideEdit } from "mmt-core/apiFormatEdit";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import MethodUrlBar from "../components/MethodUrlBar";
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
import ApiTestsEditor from "./ApiTestsEditor";
import { formatBody } from "mmt-core/markupConvertor";
import { FormatChip } from "../components/BodyFormatControls";
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
  onModificationChange?: (requestData: Request | undefined, touchedFields: Set<keyof Request>) => void;
  onRequestReset?: (reset: () => void) => void;
  rightOfUrlButton?: React.ReactNode;
  selector?: React.ReactNode;
  initialExampleIndex?: number;
}

type EditorTab = "body" | "params" | "headers" | "cookies" | "doc" | "graphql" | "grpc" | "examples";

function countNamedEntries(record?: Record<string, unknown> | null): number {
  if (!record) {
    return 0;
  }
  return Object.keys(record).filter(key => key.trim().length > 0).length;
}

const TAB_OPTIONS: Array<{ key: EditorTab; label: string; protocol?: string }> = [
  { key: "graphql", label: "GraphQL", protocol: "graphql" },
  { key: "grpc", label: "gRPC", protocol: "grpc" },
  { key: "params", label: "Params" },
  { key: "headers", label: "Headers" },
  { key: "body", label: "Body" },
  { key: "cookies", label: "Cookies" },
  { key: "doc", label: "Doc" },
  { key: "examples", label: "Examples" },
];

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

const APITest: React.FC<APITestProps> = ({ api, onUpdateApi, onModificationChange, onRequestReset, rightOfUrlButton, selector, initialExampleIndex }) => {
  const { mmtFilePath } = useContext(FileContext);
  const {
    requestData,
    touchedFields,
    responseData,
    responseRevision,
    selectedExampleIdx,
    setSelectedExampleIdx,
    currentInputs,
    setCurrentInputs,
    envValues,
    autoFormatBody,
    outputs,
    apiTestResults,
    updateField,
    restoreField,
    handleUrlChange,
    handleQueryChange,
    handleAddOutputVariable,
    prepareRequestData,
    handleSend,
    handleRunInCore,
    handleCancel,
    handleConnect,
    network,
    examples,
    isSending,
  } = useAPITesterLogic({ api, onUpdateApi, filePath: mmtFilePath, initialExampleIndex });

  const bodyValueContext = useMemo(
    () => ({ inputs: currentInputs, env: envValues }),
    [currentInputs, envValues],
  );

  const [bodyTokenMode, setBodyTokenMode] = useState<BodyTokenMode>("resolved");

  useEffect(() => {
    onModificationChange?.(requestData, touchedFields);
  }, [requestData, touchedFields, onModificationChange]);

  useEffect(() => {
    onRequestReset?.(() => {
      setBodyTokenMode("resolved");
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
    setBodyTokenMode("resolved");
    // Seed storage preference from the newly opened file only.
    setBodyYamlEncodedManual(isStructuredYamlBody(api.body));
    setBodyYamlEncodeError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on file switch
  }, [mmtFilePath]);

  // Based on the displayed URL (not resolved inputs/env)
  const isDisplayedUrlWebSocket = (protocol: Protocol | undefined, url: string | undefined
  ): boolean => {
    return protocolResolver.getEffectiveProtocol(protocol, url) === "ws";
  };

  const isGraphQL = requestData?.protocol === "graphql";
  const isGrpc = requestData?.protocol === "grpc";
  const requestProtocol = requestData?.protocol || api.protocol;
  const effectiveProtocol = protocolResolver.getEffectiveProtocol(
    requestData?.protocol || api.protocol,
    requestData?.url
  );
  const methodOrProtocolValue = (effectiveProtocol === "ws" || effectiveProtocol === "graphql" || effectiveProtocol === "grpc")
    ? `protocol:${effectiveProtocol}`
    : `method:${resolveApiHttpMethod(
        requestData?.method || api.method,
        requestData?.body ?? api.body).toLowerCase()}`;
  const methodOrProtocolKey = methodOrProtocolValue.startsWith("protocol:")
    ? methodOrProtocolValue.slice("protocol:".length)
    : methodOrProtocolValue.slice("method:".length);
  const currentRequestFormat = requestFormat(requestData?.format ?? api.format);
  const currentResponseFormat = responseFormat(requestData?.format ?? api.format);
  const resolvedRequestFormat = resolveRequestFormat(
    currentRequestFormat,
    requestData?.headers,
    methodOrProtocolValue.startsWith("method:") ? methodOrProtocolKey : undefined,
  );
  // Resolved preview shows substituted i:/e:/r:/c: values. Token mode uses a
  // separate BodyView with {{…}} markers (own Ctrl+Z stack).
  const requestBodyDisplay = useMemo(() => {
    if (!touchedFields.has("body")) {
      return displayRequestBody(
        requestData?.body ?? api.body ?? "",
        resolvedRequestFormat,
        { valueContext: bodyValueContext },
      );
    }
    const override = requestData?.body;
    const packed = typeof override === "string"
      ? bodyForYamlSave(api.body, override, resolvedRequestFormat)
      : override;
    try {
      const resolved = resolveApiRequest(
        { ...api, body: packed ?? api.body } as typeof api,
        currentInputs,
        envValues,
        { preserveStructuredBody: true },
      );
      return displayRequestBody(resolved.body, resolvedRequestFormat, {
        valueContext: bodyValueContext,
      });
    } catch {
      return typeof override === "string"
        ? override
        : displayRequestBody(override ?? "", resolvedRequestFormat);
    }
  }, [
    touchedFields,
    requestData?.body,
    api,
    resolvedRequestFormat,
    currentInputs,
    envValues,
    bodyValueContext,
  ]);
  const headerTokenSrc = useMemo(() => headersTokenSource(api), [api]);
  const queryTokenSrc = useMemo(() => queryTokenSource(api), [api]);
  const displayUrl = useMemo(
    () => displayRuntimeString(
      requestData?.url ?? "",
      touchedFields.has("url") ? undefined : api.url,
    ),
    [requestData?.url, api.url, touchedFields],
  );
  const displayQuery = useMemo(
    () => displayRequestStringRecord(
      requestData?.query as Record<string, unknown> | undefined,
      queryTokenSrc,
      { touched: touchedFields.has("query") || touchedFields.has("url") },
    ),
    [requestData?.query, queryTokenSrc, touchedFields],
  );
  const displayHeaders = useMemo(
    () => displayRequestStringRecord(
      requestData?.headers as Record<string, unknown> | undefined,
      headerTokenSrc,
      { touched: touchedFields.has("headers") },
    ),
    [requestData?.headers, headerTokenSrc, touchedFields],
  );
  const displayCookies = useMemo(
    () => displayRequestStringRecord(
      requestData?.cookies as Record<string, unknown> | undefined,
      api.cookies as Record<string, unknown> | undefined,
      { touched: touchedFields.has("cookies") },
    ),
    [requestData?.cookies, api.cookies, touchedFields],
  );
  const displayGraphqlVariables = useMemo(
    () => displayRequestStringRecord(
      (requestData?.graphql?.variables ?? api.graphql?.variables) as
        | Record<string, unknown>
        | undefined,
      api.graphql?.variables as Record<string, unknown> | undefined,
      { touched: touchedFields.has("graphql") },
    ),
    [requestData?.graphql?.variables, api.graphql?.variables, touchedFields],
  );
  const displayGrpcMessage = useMemo(
    () => displayRequestStringRecord(
      (requestData?.grpc?.message ?? api.grpc?.message) as
        | Record<string, unknown>
        | undefined,
      api.grpc?.message as Record<string, unknown> | undefined,
      { touched: touchedFields.has("grpc") },
    ),
    [requestData?.grpc?.message, api.grpc?.message, touchedFields],
  );

  const onUrlChange = useCallback((newUrl: string) => {
    if (!touchedFields.has("url")) {
      handleUrlChange(enterEditStringBuffer(displayUrl, newUrl, api.url));
      return;
    }
    handleUrlChange(newUrl);
  }, [touchedFields, displayUrl, api.url, handleUrlChange]);

  const onQueryChange = useCallback((query: Record<string, string>) => {
    if (!touchedFields.has("query") && !touchedFields.has("url")) {
      handleQueryChange(enterEditStringRecord(displayQuery, query, queryTokenSrc));
      return;
    }
    handleQueryChange(query);
  }, [touchedFields, displayQuery, queryTokenSrc, handleQueryChange]);

  const onHeadersChange = useCallback((headers: Record<string, string>) => {
    if (!touchedFields.has("headers")) {
      updateField("headers", enterEditStringRecord(displayHeaders, headers, headerTokenSrc));
      return;
    }
    updateField("headers", headers);
  }, [touchedFields, displayHeaders, headerTokenSrc, updateField]);

  const onCookiesChange = useCallback((cookies: Record<string, string>) => {
    if (!touchedFields.has("cookies")) {
      updateField(
        "cookies",
        enterEditStringRecord(
          displayCookies,
          cookies,
          api.cookies as Record<string, unknown> | undefined,
        ),
      );
      return;
    }
    updateField("cookies", cookies);
  }, [touchedFields, displayCookies, api.cookies, updateField]);

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
    !isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url);
  const runInputs = useMemo(() => ({
    exampleIndex: selectedExampleIdx,
    manualInputs: currentInputs
  }), [currentInputs, selectedExampleIdx]);

  const [editorTab, setEditorTabInternal] = useState<EditorTab>(() => {
    const saved = localStorage.getItem("apitest-editor-tab");
    // Legacy tabs merged into Examples.
    if (saved === "inout" || saved === "tests") {
      return "examples";
    }
    if (saved === "body" || saved === "params" || saved === "headers" || saved === "cookies" || saved === "doc" || saved === "graphql" || saved === "grpc" || saved === "examples") {
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

  const setEditorTab = (tab: EditorTab) => {
    setEditorTabInternal(tab);
    localStorage.setItem("apitest-editor-tab", tab);
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
      updateField("protocol", protocol);
      if (protocol === "graphql" || protocol === "grpc") {
        setEditorTab(protocol);
      } else if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
      return;
    }
    if (raw.startsWith("method:")) {
      const method = raw.slice("method:".length) as Method;
      updateField("method", method);
      updateField("protocol", "http");
      if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("body");
      }
    }
  };

  const shouldShowQuery = () => editorTab === "params";
  const shouldShowHeaders = () => editorTab === "headers";
  const shouldShowCookies = () => editorTab === "cookies";
  const shouldShowBody = () => editorTab === "body";
  const shouldShowInputs = () => editorTab === "examples";
  const shouldShowResponse = () => editorTab === "body";
  const shouldShowResponseHeaders = () => editorTab === "headers";
  const shouldShowResponseCookies = () => editorTab === "cookies";
  const shouldShowDoc = () => editorTab === "doc";
  const shouldShowGraphql = () => editorTab === "graphql";
  const shouldShowGrpc = () => editorTab === "grpc";
  const shouldShowExamples = () => editorTab === "examples";
  const setBodyFormat = (side: "request" | "response", format: RequestFormat | ResponseFormat) => {
    // Format chips are temporary UI (like body edits): deduced from YAML on
    // open/reset, independently editable per side, exit temp when both sides
    // match the YAML baseline again. Store an explicit object while touched so
    // request/response stay independent (scalar YAML means response:auto).
    const result = applyFormatSideEdit({
      side,
      value: format,
      yamlFormat: api.format,
      currentFormat: requestData?.format ?? api.format,
      formatTouched: touchedFields.has("format"),
    });
    if (result.kind === "exitTemp") {
      restoreField("format", result.format);
    } else {
      updateField("format", result.format);
    }
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

  return (
    <div className={`apitest-root${selector ? " apitest-root--source" : ""}`}>
      {/* ── Fixed header: URL bar + tab bar ── */}
      <div className="apitest-fixed-header">
      <div className="apitest-url-row" style={methodChromeVars as React.CSSProperties}>
        {selector}
        <MethodUrlBar
          methodValue={methodOrProtocolValue}
          onMethodChange={handleMethodOrProtocolChange}
          url={displayUrl}
          query={displayQuery}
          onUrlChange={onUrlChange}
          onQueryChange={onQueryChange}
          previewMuted={
            !touchedFields.has("url") &&
            typeof api.url === "string" &&
            /(?:<<\s*[ierce]:|(?:^|[^A-Za-z0-9_])[ierce]:|\{\{\s*(?:[ierce]:|random|current))/i
              .test(api.url)
          }
        />
        {rightOfUrlButton && (
          <div className="apitest-url-row-actions">
            {rightOfUrlButton}
          </div>
        )}
      </div>

      <div className="apitest-tabs-row">
        <div className="tab-bar is-gap">
          {TAB_OPTIONS
            .filter(tab => {
              // Hide body/params/cookies for graphql/grpc protocols
              if ((isGraphQL || isGrpc) && (tab.key === "body" || tab.key === "params" || tab.key === "cookies")) {
                return false;
              }
              // Only show protocol-specific tabs for matching protocol
              if (tab.protocol) {
                if (tab.protocol === "graphql") { return isGraphQL; }
                if (tab.protocol === "grpc") { return isGrpc; }
              }
              return true;
            })
            .map(tab => {
              const active = editorTab === tab.key;
              const count = tab.key === "headers"
                ? countNamedEntries(requestData?.headers || api.headers)
                : tab.key === "cookies"
                  ? countNamedEntries(requestData?.cookies || api.cookies)
                  : tab.key === "examples"
                    ? examples.filter(ex => ex && typeof ex === "object").length
                    : 0;
              return (
            <button
              key={tab.key}
              className={`tab-button-small ${active ? "active" : ""}`}
              onClick={() => setEditorTab(tab.key)}
            >
              {tab.label}
              {count > 0 ? <span className="apitest-tab-count">{count}</span> : null}
            </button>
              );
            })}
        </div>
      </div>
      </div>

      {/* ── Scrollable content area: fills between header and toolbar ── */}
      <div className="apitest-content">

      {/* Request section */}
      <div className="apitest-section apitest-section--request">
        {shouldShowQuery() && <KSVEditor
          label="Query parameters"
          value={displayQuery}
          onChange={onQueryChange}
        />}
        {shouldShowHeaders() && <KSVEditor
          label="Request Headers"
          value={displayHeaders}
          onChange={onHeadersChange}
        />}
        {shouldShowCookies() && <KSVEditor
          label="Manual Cookies"
          value={displayCookies}
          onChange={onCookiesChange}
        />}
        {shouldShowDoc() && api.description ? (
          <MdViewer
            description={api.description}
            inputs={api.inputs}
            outputs={api.outputs}
          />
        ) : shouldShowDoc() ? (
          <div className="apitest-empty">
            No description available.
          </div>
        ) : null}
        {shouldShowBody() && (
          <div className="apitest-body-pane">
            <div className="apitest-body-toolbar">
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
                    value={typeof requestData?.body === "string" ? requestData.body : ""}
                    basePath={mmtFilePath}
                    showFilePicker
                    placeholder="Relative path to binary file"
                    onChange={val => updateField("body", val)}
                    onEnterPressed={val => updateField("body", val)}
                  />
                ) : resolvedRequestFormat === "multipart" ? (
                  <MultipartPartsEditor
                    value={requestData?.body}
                    onChange={parts => updateField("body", parts)}
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
                value={displayRuntimeString(
                  requestData?.graphql?.operation || api.graphql?.operation || "",
                  touchedFields.has("graphql") ? undefined : api.graphql?.operation,
                )}
                format="graphql"
                mode="live"
                onChange={val => {
                  const operation = !touchedFields.has("graphql")
                    ? enterEditStringBuffer(
                        displayRuntimeString(
                          requestData?.graphql?.operation || api.graphql?.operation || "",
                          api.graphql?.operation,
                        ),
                        val,
                        api.graphql?.operation,
                      )
                    : val;
                  updateField("graphql", { ...requestData?.graphql, ...api.graphql, operation });
                }}
              />
            </div>
            <KSVEditor
              label="Variables"
              value={displayGraphqlVariables}
              onChange={variables => {
                const entered = !touchedFields.has("graphql")
                  ? enterEditStringRecord(
                      displayGraphqlVariables,
                      variables,
                      api.graphql?.variables as Record<string, unknown> | undefined,
                    )
                  : variables;
                const vars = Object.keys(entered).length ? entered : undefined;
                updateField("graphql", { ...requestData?.graphql, ...api.graphql, variables: vars });
              }}
            />
          </>
        )}

        {shouldShowGrpc() && (
          <>
            <div className="field-inline is-gap is-spaced">
              <div className="field-grow">
                <div className="label">Service</div>
                <input
                  type="text"
                  placeholder="package.ServiceName"
                  value={requestData?.grpc?.service || api.grpc?.service || ""}
                  onChange={e => {
                    updateField("grpc", { ...requestData?.grpc, ...api.grpc, service: e.target.value });
                  }}
                  className="mmt-fill"
                />
              </div>
              <div className="field-grow">
                <div className="label">Method</div>
                <input
                  type="text"
                  placeholder="MethodName"
                  value={requestData?.grpc?.method || api.grpc?.method || ""}
                  onChange={e => {
                    updateField("grpc", { ...requestData?.grpc, ...api.grpc, method: e.target.value });
                  }}
                  className="mmt-fill"
                />
              </div>
            </div>
            <KSVEditor
              label="Message"
              value={displayGrpcMessage}
              onChange={msg => {
                const entered = !touchedFields.has("grpc")
                  ? enterEditStringRecord(
                      displayGrpcMessage,
                      msg,
                      api.grpc?.message as Record<string, unknown> | undefined,
                    )
                  : msg;
                const message = Object.keys(entered).length ? entered : undefined;
                updateField("grpc", { ...requestData?.grpc, ...api.grpc, message });
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
                    .map((ex, idx) => (
                      <option key={exampleId(ex) || idx} value={idx}>
                        {exampleTitle(ex) || exampleId(ex) || `Example ${idx + 1}`}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="button-icon no-shrink"
                  onClick={handleAddAsTest}
                  title="Add as test"
                  aria-label="Add as test"
                >
                  <span className="codicon codicon-add" aria-hidden />
                </button>
              </div>
            </div>
            <VEditor
              label="Inputs"
              value={currentInputs}
              onChange={handleInputsChange}
              keyOptions={typeof api.inputs === "object" ? Object.keys(api.inputs || {}) : []}
              inputConstraints={inputConstraints}
              deletable={false}
            />
          </>
        )}
      </div>

      {/* Send button row */}
      <div className="apitest-send-row">
        <div className="apitest-send-controls">
          {isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url) && (
            <ConnectButton
              connected={network.connected}
              onClick={handleConnect}
            />
          )}
          <SendButton
            accent={methodOrProtocolAccent}
            onClick={sendWithResolvedBody}
            onCancel={handleCancel}
            disabled={isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url) && !network.connected}
            loading={
              isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url)
                ? network.loading
                : isSending
            }
            contextMenuItems={sendContextMenuItems}
          />
        </div>
        <div className="horizontal-line horizontal-line--below" />
      </div>

      {/* Response section */}
      <div className="apitest-section apitest-section--response">
        {shouldShowResponseHeaders() && (
          <KSVEditor
            label="Response headers"
            value={responseData?.headers || {}}
            onChange={headers => { }}
            deactivated={true}
          />
        )}

        {shouldShowResponseCookies() && (
          <KSVEditor
            label="Cookies"
            value={responseData?.cookies || {}}
            onChange={cookies => { }}
            deactivated={true}
          />
        )}

        {(shouldShowResponse() || shouldShowGraphql() || shouldShowGrpc()) && (
          <div className="apitest-body-pane">
            <ResponseBodyBar
              type={currentResponseFormat}
              view={responseDisplay.effectiveView}
              prettyAvailable={responseDisplay.prettyAvailable}
              previewAvailable={responseDisplay.previewAvailable}
              onTypeChange={type => setBodyFormat("response", type)}
              onViewChange={setResponseViewMode}
            />
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

        {shouldShowExamples() && (
          selectedExampleIdx < 0 || !examples[selectedExampleIdx] ? (
            <div className="apitest-empty">Select an example to edit expect / require.</div>
          ) : (
            <ApiTestsEditor
              test={{
                expect: exampleExpect(examples[selectedExampleIdx]),
                require: examples[selectedExampleIdx].require,
              }}
              results={apiTestResults}
              fieldSuggestions={typeof api.outputs === "object" ? Object.keys(api.outputs || {}) : []}
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
                  if (next?.require) {
                    updated.require = next.require;
                  } else {
                    delete updated.require;
                  }
                  return updated;
                });
                onUpdateApi?.({ examples: nextExamples });
              }}
            />
          )
        )}
      </div>

      </div>

      {/* ── Fixed bottom toolbar ── */}
      <div className="apitest-toolbar">
        <div className="horizontal-line horizontal-line--above" />
        <div className="apitest-toolbar-inner">
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

          <button
            type="button"
            onClick={() => {
              showHistoryPanel();
            }}
            className="toolbar-button"
            title="Show History Panel"
          >
            <span className="codicon codicon-history toolbar-button-icon"></span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default APITest;