import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from "react";
import { extractInputConstraintsFromDescription } from "mmt-core/paramConstraints";
import { APIData, exampleId, exampleTitle } from "mmt-core/APIData";
import { JSONRecord, Method, Protocol, RequestFormat, ResponseFormat, requestFormat, responseFormat } from "mmt-core/CommonData";
import { resolveRequestFormat } from "mmt-core/formatResolve";
import { Request } from "mmt-core/NetworkData";
import KSVEditor from "../components/KSVEditor";
import BodyView from "../components/BodyView";
import FilePickerInput from "../components/FilePickerInput";
import MultipartPartsEditor from "../components/MultipartPartsEditor";
import {
  applyRequestBodyEdit,
  displayRequestBody,
  displayRequestStringRecord,
  displayRuntimeString,
  headersTokenSource,
  queryTokenSource,
  type BodyTempBaseline,
} from "mmt-core/apiBodyEdit";
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
import {
  accentChromeCssVars,
  accentChromeFor,
} from "../shared/themeAccent";
import { findMatchingExampleIndex } from "./apiExampleMatch";
import { SELECT_EXAMPLE_EVENT } from "../text/exampleSelect";

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  onModificationChange?: (requestData: Request | undefined, touchedFields: Set<keyof Request>) => void;
  onRequestReset?: (reset: () => void) => void;
  rightOfUrlButton?: React.ReactNode;
  selector?: React.ReactNode;
  initialExampleIndex?: number;
}

type EditorTab = "inout" | "body" | "params" | "headers" | "cookies" | "doc" | "graphql" | "grpc" | "tests";

function countNamedEntries(record?: Record<string, unknown> | null): number {
  if (!record) {
    return 0;
  }
  return Object.keys(record).filter(key => key.trim().length > 0).length;
}

const TAB_OPTIONS: Array<{ key: EditorTab; label: string; protocol?: string }> = [
  { key: "inout", label: "In / Out" },
  { key: "graphql", label: "GraphQL", protocol: "graphql" },
  { key: "grpc", label: "gRPC", protocol: "grpc" },
  { key: "body", label: "Body" },
  { key: "params", label: "Params" },
  { key: "headers", label: "Headers" },
  { key: "cookies", label: "Cookies" },
  { key: "doc", label: "Doc" },
  { key: "tests", label: "Tests" },
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

/** Compare run output vs example expected value (allows string/number coercion). */
function outputValuesMatch(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) {
    return true;
  }
  if (actual === undefined || expected === undefined) {
    return false;
  }
  if (actual === null || expected === null) {
    return actual === expected;
  }
  if (typeof actual === "object" || typeof expected === "object") {
    try {
      return JSON.stringify(actual) === JSON.stringify(expected);
    } catch {
      return false;
    }
  }
  return String(actual) === String(expected);
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

  useEffect(() => {
    onModificationChange?.(requestData, touchedFields);
  }, [requestData, touchedFields, onModificationChange]);

  useEffect(() => {
    if (!onRequestReset) { return; }
    // Full reset: restore baseline inputs from YAML/`api`, clear touches, rebuild request.
    onRequestReset(() => {
      const baseInputs = selectedExampleIdx === -1
        ? (api.inputs || {})
        : (examples[selectedExampleIdx]?.inputs || {});
      const nextInputs = cloneInputs(baseInputs);
      setCurrentInputs(nextInputs);
      prepareRequestData(nextInputs, { forceReset: true, scopes: ["all"] });
    });
  }, [onRequestReset, prepareRequestData, api, examples, selectedExampleIdx, setCurrentInputs]);

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
  // Untouched structured YAML body → format projection for highlight.
  // Once the user edits, requestData.body is raw text (temporary modified state);
  // keep it as-is so mid-edit invalid JSON/XML is allowed and Send uses editor text.
  // r:/c: markers from YAML are shown as {{random …}} / {{current …}} (not resolved values).
  const requestBodySource = requestData?.body ?? api.body ?? "";
  const requestBodyDisplay = displayRequestBody(
    requestBodySource,
    resolvedRequestFormat,
    touchedFields.has("body") ? undefined : { tokenSource: api.body },
  );
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
  const sendContextMenuItems = useMemo(() => [
    {
      label: "Run in Core",
      icon: "codicon-play",
      onClick: handleRunInCore,
    },
    ...(canRunCurl ? [{
      label: "Run in Curl",
      icon: "codicon-terminal",
      onClick: () => {
        window.vscode?.postMessage({
          command: "runCurlCommand",
          request: requestData,
          inputs: runInputs
        });
      }
    }] : [])
  ], [canRunCurl, handleRunInCore, requestData, runInputs]);

  const [editorTab, setEditorTabInternal] = useState<EditorTab>(() => {
    const saved = localStorage.getItem("apitest-editor-tab");
    if (saved === "body" || saved === "params" || saved === "headers" || saved === "cookies" || saved === "doc" || saved === "graphql" || saved === "grpc" || saved === "inout" || saved === "tests") {
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
        setEditorTab("inout");
      }
      return;
    }
    if (raw.startsWith("method:")) {
      const method = raw.slice("method:".length) as Method;
      updateField("method", method);
      updateField("protocol", "http");
      if (editorTab === "graphql" || editorTab === "grpc") {
        setEditorTab("inout");
      }
    }
  };

  const shouldShowQuery = () => editorTab === "params";
  const shouldShowHeaders = () => editorTab === "headers";
  const shouldShowCookies = () => editorTab === "cookies";
  const shouldShowBody = () => editorTab === "body";
  const shouldShowInputs = () => editorTab === "inout";
  const shouldShowResponse = () => editorTab === "body";
  const shouldShowResponseHeaders = () => editorTab === "headers";
  const shouldShowResponseCookies = () => editorTab === "cookies";
  const shouldShowOutputs = () => editorTab === "inout";
  const shouldShowDoc = () => editorTab === "doc";
  const shouldShowGraphql = () => editorTab === "graphql";
  const shouldShowGrpc = () => editorTab === "grpc";
  const shouldShowTests = () => editorTab === "tests";
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
      return;
    }
    updateField("format", result.format);
  };

  // Snapshot of projected display + body taken on first edit; exact revert exits temp mode.
  const bodyTempBaselineRef = useRef<BodyTempBaseline | null>(null);

  useEffect(() => {
    if (!touchedFields.has("body")) {
      bodyTempBaselineRef.current = null;
    }
  }, [touchedFields]);

  const handleRequestBodyChange = (value: string) => {
    const result = applyRequestBodyEdit({
      value,
      currentBody: requestData?.body ?? api.body ?? "",
      format: resolvedRequestFormat,
      baseline: bodyTempBaselineRef.current,
      bodyAlreadyTouched: touchedFields.has("body"),
      tokenSource: api.body,
    });
    bodyTempBaselineRef.current = result.baseline;
    if (result.kind === "exitTemp") {
      restoreField("body", result.body);
      return;
    }
    updateField("body", result.body);
  };

  const inputConstraints = useMemo(
    () => extractInputConstraintsFromDescription(api.description || ""),
    [api.description]
  );

  // Match icons are tied to the response that was produced for a specific
  // example + inputs snapshot. Changing either clears icons until the next run.
  const [matchBaseline, setMatchBaseline] = useState<{ exampleIdx: number; inputsKey: string } | null>(null);
  useEffect(() => {
    if (!responseData) {
      setMatchBaseline(null);
      return;
    }
    setMatchBaseline({
      exampleIdx: selectedExampleIdx,
      inputsKey: JSON.stringify(currentInputs),
    });
    // Only stamp when a new response arrives — not when inputs/example change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseRevision, responseData]);

  const outputMatchStatus = useMemo(() => {
    const status = new Map<string, "match" | "mismatch">();
    if (selectedExampleIdx < 0 || !responseData || !matchBaseline) {
      return status;
    }
    if (
      matchBaseline.exampleIdx !== selectedExampleIdx ||
      matchBaseline.inputsKey !== JSON.stringify(currentInputs)
    ) {
      return status;
    }
    const expected = examples[selectedExampleIdx]?.outputs;
    const expectedObj = expected && typeof expected === "object" ? expected : {};
    const outputKeys = typeof api.outputs === "object" ? Object.keys(api.outputs || {}) : [];

    outputKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(expectedObj, key)) {
        return;
      }
      if (outputValuesMatch(outputs[key], expectedObj[key])) {
        status.set(key, "match");
      } else {
        status.set(key, "mismatch");
      }
    });
    return status;
  }, [selectedExampleIdx, examples, outputs, responseData, api.outputs, currentInputs, matchBaseline]);

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
    const match = findMatchingExampleIndex(examples, data);
    if (match !== selectedExampleIdx) {
      setSelectedExampleIdx(match);
    }
  };

  const handleAddAsExample = () => {
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

    const newExample: { id: string; title?: string; inputs?: JSONRecord; outputs?: JSONRecord } = {
      id: newId,
      title: newId,
    };
    if (Object.keys(currentInputs).length) {
      newExample.inputs = cloneInputs(currentInputs);
    }

    // Only persist outputs that are defined on the API — never invent status_code.
    const definedOutputKeys = Object.keys(api.outputs || {});
    if (definedOutputKeys.length > 0) {
      const exampleOutputs: JSONRecord = {};
      definedOutputKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(outputs, key)) {
          exampleOutputs[key] = outputs[key];
        }
      });
      if (Object.keys(exampleOutputs).length > 0) {
        newExample.outputs = exampleOutputs;
      }
    }

    const updatedExamples = [...(api.examples || []), newExample];
    onUpdateApi?.({ examples: updatedExamples });
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
          onUrlChange={handleUrlChange}
          onQueryChange={handleQueryChange}
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
                  : tab.key === "tests"
                    ? (() => {
                        const ex = selectedExampleIdx >= 0 ? examples[selectedExampleIdx] : undefined;
                        return Object.keys(ex?.expect || {}).length +
                            Object.keys(ex?.require || {}).length;
                      })()
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
          onChange={query => updateField("query", query)}
        />}
        {shouldShowHeaders() && <KSVEditor
          label="Request Headers"
          value={displayHeaders}
          onChange={headers => updateField("headers", headers)}
        />}
        {shouldShowCookies() && <KSVEditor
          label="Manual Cookies"
          value={displayCookies}
          onChange={cookies => updateField("cookies", cookies)}
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
            <BodyFormatBar
              value={currentRequestFormat}
              onChange={format => setBodyFormat("request", format)}
            />
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
                ) : (
                  <BodyView
                    value={requestBodyDisplay}
                    format={resolvedRequestFormat}
                    mode="live"
                    onChange={handleRequestBodyChange}
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
                  updateField("graphql", { ...requestData?.graphql, ...api.graphql, operation: val });
                }}
              />
            </div>
            <KSVEditor
              label="Variables"
              value={displayGraphqlVariables}
              onChange={variables => {
                const vars = Object.keys(variables).length ? variables : undefined;
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
                const message = Object.keys(msg).length ? msg : undefined;
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
                  onClick={handleAddAsExample}
                  title="Add as example"
                  aria-label="Add as example"
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

        {shouldShowTests() && (
          <>
            <div className="apitest-example">
              <div className="label">Example</div>
              <div className="field-inline is-gap">
                <select
                  value={selectedExampleIdx ?? -1}
                  onChange={e => handleExampleChange(Number(e.target.value))}
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
              </div>
            </div>
            {selectedExampleIdx < 0 || !examples[selectedExampleIdx] ? (
              <div className="apitest-empty">Select an example to edit tests.</div>
            ) : (
              <ApiTestsEditor
                test={{
                  expect: examples[selectedExampleIdx].expect,
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
            )}
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
            onClick={handleSend}
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

        {shouldShowOutputs() && (
          <VEditor
            label="Outputs"
            value={outputs}
            onChange={() => { }}
            keyOptions={typeof api.outputs === "object" ? Object.keys(api.outputs || {}) : []}
            deletable={false}
            copyable={true}
            matchStatus={outputMatchStatus}
          />
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