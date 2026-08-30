import React, { useState, useContext, useEffect, useMemo } from "react";
import { extractInputConstraintsFromDescription } from "mmt-core/paramConstraints";
import { APIData } from "mmt-core/APIData";
import { JSONRecord, Method, Protocol, requestFormat, responseFormat } from "mmt-core/CommonData";
import { Request } from "mmt-core/NetworkData";
import KSVEditor from "../components/KSVEditor";
import BodyView from "../components/BodyView";
import FilePickerInput from "../components/FilePickerInput";
import { formatBody } from "mmt-core/markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import ToggleButton from "../components/ToggleButton";
import UrlInput from "../components/UrlInput";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";
import VEditor from "../components/VEditor";
import { FileContext } from "../fileContext";
import { showHistoryPanel } from "../vsAPI";
import { useAPITesterLogic } from "./useAPITesterLogic";
import { displayResponseBody } from "./responseBodyDisplay";
import { protocolResolver } from "mmt-core";
import MdViewer from "../components/MdViewer";
import {
  accentChromeCssVars,
  accentChromeFor,
} from "../shared/themeAccent";

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  onModificationChange?: (requestData: Request | undefined, touchedFields: Set<keyof Request>) => void;
  onRequestReset?: (reset: () => void) => void;
  rightOfUrlButton?: React.ReactNode;
  selector?: React.ReactNode;
  initialExampleIndex?: number;
}

type EditorTab = "inout" | "body" | "params" | "headers" | "cookies" | "doc" | "graphql" | "grpc";

const TAB_OPTIONS: Array<{ key: EditorTab; label: string; protocol?: string }> = [
  { key: "inout", label: "In / Out" },
  { key: "graphql", label: "GraphQL", protocol: "graphql" },
  { key: "grpc", label: "gRPC", protocol: "grpc" },
  { key: "body", label: "Body" },
  { key: "params", label: "Params" },
  { key: "headers", label: "Headers" },
  { key: "cookies", label: "Cookies" },
  { key: "doc", label: "Doc" }
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

const HTTP_METHODS: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
const OTHER_PROTOCOLS: Protocol[] = ["ws", "graphql", "grpc"];

const PROTOCOL_LABELS: Record<string, string> = {
  ws: "WS",
  graphql: "GraphQL",
  grpc: "gRPC",
};

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
    setAutoFormatBody,
    outputs,
    updateField,
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
    : `method:${(requestData?.method || api.method || "get").toLowerCase()}`;
  const methodOrProtocolKey = methodOrProtocolValue.startsWith("protocol:")
    ? methodOrProtocolValue.slice("protocol:".length)
    : methodOrProtocolValue.slice("method:".length);
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
    if (saved === "body" || saved === "params" || saved === "headers" || saved === "cookies" || saved === "doc" || saved === "graphql" || saved === "grpc" || saved === "inout") {
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

  const handleExampleChange = (newIdx: number) => {
    setSelectedExampleIdx(newIdx);
    const baseInputs = newIdx === -1
      ? (api.inputs || {})
      : (examples[newIdx]?.inputs || {});
    const nextInputs = cloneInputs(baseInputs);
    setCurrentInputs(nextInputs);
    prepareRequestData(nextInputs);
  };

  const handleAddAsExample = () => {
    const newExampleNameBase = "example";
    let newName = newExampleNameBase;
    const nameSet = new Set((api.examples || []).map(e => (e?.name || "").toLowerCase()));
    let counter = 1;
    while (nameSet.has(newName.toLowerCase())) {
      newName = `${newExampleNameBase}${counter++}`;
    }

    const newExample: { name: string; inputs?: JSONRecord; outputs?: JSONRecord } = { name: newName };
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
      <div className="apitest-url-row" style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
        <div className="apitest-method-cluster" style={methodChromeVars as React.CSSProperties}>
          {selector}
          <select
          className="method-select"
          value={methodOrProtocolValue}
          onChange={e => handleMethodOrProtocolChange(e.target.value)}
          title="HTTP method or protocol (temporary override)"
        >
          {HTTP_METHODS.map(m => (
            <option key={m} value={`method:${m}`}>{m.toUpperCase()}</option>
          ))}
          <option disabled value="__sep__">────────</option>
          {OTHER_PROTOCOLS.map(p => (
            <option key={p} value={`protocol:${p}`}>{PROTOCOL_LABELS[p] || p}</option>
          ))}
        </select>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <UrlInput
            url={requestData?.url ?? ""}
            query={requestData?.query || {}}
            onUrlChange={handleUrlChange}
            onQueryChange={handleQueryChange}
          />
        </div>
        {rightOfUrlButton && (
          <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 2 }}>
            {rightOfUrlButton}
          </div>
        )}
      </div>

      <div className="apitest-tabs-row">
        <div className="tab-bar" style={{ gap: 8 }}>
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
            .map(tab => (
            <button
              key={tab.key}
              className={`tab-button-small ${editorTab === tab.key ? "active" : ""}`}
              onClick={() => setEditorTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* ── Scrollable content area: fills between header and toolbar ── */}
      <div className="apitest-content">

      {/* Request section */}
      <div className="apitest-section apitest-section--request">
        {shouldShowQuery() && <KSVEditor
          label="Query parameters"
          value={requestData?.query || {}}
          onChange={query => updateField("query", query)}
        />}
        {shouldShowHeaders() && <KSVEditor
          label="Request Headers"
          value={requestData?.headers || {}}
          onChange={headers => updateField("headers", headers)}
        />}
        {shouldShowCookies() && <KSVEditor
          label="Manual Cookies"
          value={requestData?.cookies || {}}
          onChange={cookies => updateField("cookies", cookies)}
        />}
        {shouldShowDoc() && api.description ? (
          <MdViewer
            description={api.description}
            inputs={api.inputs}
            outputs={api.outputs}
          />
        ) : shouldShowDoc() ? (
          <div style={{ padding: "12px", color: "var(--vscode-disabledForeground, #666)", fontSize: "12px" }}>
            No description available.
          </div>
        ) : null}
        {shouldShowBody() && (
          <>
            <div className="label">Request Body</div>
            <div className="apitest-body-wrapper" data-mmt-coach="body">
              {requestFormat(requestData?.format) === "binary" ? (
                <FilePickerInput
                  value={typeof requestData?.body === "string" ? requestData.body : ""}
                  basePath={mmtFilePath}
                  showFilePicker
                  placeholder="Relative path to binary file"
                  onChange={val => updateField("body", val)}
                  onEnterPressed={val => updateField("body", val)}
                />
              ) : (
                <BodyView
                  value={typeof requestData?.body === "string"
                    ? requestData?.body
                    : formatBody(requestFormat(requestData?.format), requestData?.body || {})
                  }
                  format={requestFormat(requestData?.format)}
                  mode="live"
                  onChange={val => {
                    updateField("body", val);
                  }}
                />
              )}
            </div>
          </>
        )}

        {shouldShowGraphql() && (
          <>
            <div className="label">Operation</div>
            <div className="apitest-body-wrapper">
              <BodyView
                value={requestData?.graphql?.operation || api.graphql?.operation || ""}
                format="graphql"
                mode="live"
                onChange={val => {
                  updateField("graphql", { ...requestData?.graphql, ...api.graphql, operation: val });
                }}
              />
            </div>
            <KSVEditor
              label="Variables"
              value={requestData?.graphql?.variables ?? api.graphql?.variables ?? {}}
              onChange={variables => {
                const vars = Object.keys(variables).length ? variables : undefined;
                updateField("graphql", { ...requestData?.graphql, ...api.graphql, variables: vars });
              }}
            />
          </>
        )}

        {shouldShowGrpc() && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="label">Service</div>
                <input
                  type="text"
                  placeholder="package.ServiceName"
                  value={requestData?.grpc?.service || api.grpc?.service || ""}
                  onChange={e => {
                    updateField("grpc", { ...requestData?.grpc, ...api.grpc, service: e.target.value });
                  }}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label">Method</div>
                <input
                  type="text"
                  placeholder="MethodName"
                  value={requestData?.grpc?.method || api.grpc?.method || ""}
                  onChange={e => {
                    updateField("grpc", { ...requestData?.grpc, ...api.grpc, method: e.target.value });
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <KSVEditor
              label="Message"
              value={(requestData?.grpc?.message ?? api.grpc?.message ?? {}) as Record<string, string>}
              onChange={msg => {
                const message = Object.keys(msg).length ? msg : undefined;
                updateField("grpc", { ...requestData?.grpc, ...api.grpc, message });
              }}
            />
          </>
        )}

        {shouldShowInputs() && (
          <>
            <div style={{ paddingBottom: 20, width: "100%" }}>
              <div className="label">Example</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={selectedExampleIdx ?? ""}
                  onChange={e => {
                    const newIdx = Number(e.target.value);
                    handleExampleChange(newIdx);
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <option value={-1}>Defaults</option>
                  {examples
                    .filter(ex => ex && typeof ex === "object")
                    .map((ex, idx) => (
                      <option key={ex?.name || idx} value={idx}>
                        {ex?.name || `Example ${idx + 1}`}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="button-icon"
                  onClick={handleAddAsExample}
                  title="Add as example"
                  aria-label="Add as example"
                  style={{ flexShrink: 0 }}
                >
                  <span className="codicon codicon-add" aria-hidden />
                </button>
              </div>
            </div>
            <VEditor
              label="Inputs"
              value={currentInputs}
              onChange={(data) => {
                setCurrentInputs(data);
                prepareRequestData(data, { respectTouched: false });
              }}
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
          <>
            <div className="label">Response Body</div>
            <div className="apitest-body-wrapper">
              <BodyView
                value={displayResponseBody(responseData, autoFormatBody)}
                format={responseFormat(requestData?.format)}
                mode="live"
                onInspectPosition={handleAddOutputVariable}
                refreshKey={responseRevision}
              />
            </div>
          </>
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
          <ToggleButton
            active={autoFormatBody}
            icon="sparkle-filled"
            title={`Auto-format (beautify) body ${autoFormatBody ? "on" : "off"}`}
            onClick={() => {
              const next = !autoFormatBody;
              setAutoFormatBody(next);
              window.vscode?.postMessage({
                command: "updateConfig",
                section: "multimeter",
                key: "body.auto.format",
                value: next,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default APITest;