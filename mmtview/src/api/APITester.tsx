import React, { useState, useContext } from "react";
import { APIData } from "mmt-core/APIData";
import { JSONRecord, Method, Protocol } from "mmt-core/CommonData";
import KSVEditor from "../components/KSVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "mmt-core/markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import UrlInput from "../components/UrlInput";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";
import VEditor from "../components/VEditor";
import { FileContext } from "../fileContext";
import { showHistoryPanel } from "../vsAPI";
import { useAPITesterLogic } from "./useAPITesterLogic";
import { protocolResolver } from "mmt-core";
import MdViewer from "../components/MdViewer";

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
  rightOfUrlButton?: React.ReactNode;
}

type EditorTab = "inout" | "body" | "params" | "headers" | "cookies" | "doc";

const TAB_OPTIONS: Array<{ key: EditorTab; label: string }> = [
  { key: "inout", label: "In / Out" },
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

const methodColor: Record<string, string> = {
  get: "#61affe",
  post: "#49cc90",
  put: "#fca130",
  delete: "#f93e3e",
  patch: "#50e3c2",
  head: "#9012fe",
  options: "#0d5aa7",
  trace: "#888",
  ws: "#888",
};

const APITest: React.FC<APITestProps> = ({ api, onUpdateApi, rightOfUrlButton }) => {
  const { mmtFilePath } = useContext(FileContext);
  const {
    requestData,
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
    handleCancel,
    handleConnect,
    buildCurl,
    network,
    examples
  } = useAPITesterLogic({ api, onUpdateApi, filePath: mmtFilePath });

  // Based on the displayed URL (not resolved inputs/env)
  const isDisplayedUrlWebSocket = (protocol: Protocol | undefined, url: string | undefined
  ): boolean => {
    return protocolResolver.getEffectiveProtocol(protocol, url) === "ws";
  };

  const [editorTab, setEditorTabInternal] = useState<EditorTab>(() => {
    const saved = localStorage.getItem("apitest-editor-tab");
    if (saved === "body" || saved === "params" || saved === "headers" || saved === "cookies" || saved === "doc") {
      return saved;
    }
    return "inout";
  });

  const setEditorTab = (tab: EditorTab) => {
    setEditorTabInternal(tab);
    localStorage.setItem("apitest-editor-tab", tab);
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

  const handleExampleChange = (newIdx: number) => {
    setSelectedExampleIdx(newIdx);
    const baseInputs = newIdx === -1
      ? (api.inputs || {})
      : (examples[newIdx]?.inputs || {});
    const nextInputs = cloneInputs(baseInputs);
    setCurrentInputs(nextInputs);
    prepareRequestData(nextInputs);
  };

  return (
    <div className="apitest-root">
      <div style={{ padding: "8px", display: "flex", alignItems: "stretch", gap: 8 }}>
        {isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url) ? (
          <span
            className="method-select method-badge"
            style={{ background: methodColor["ws"] }}
          >
            WS
          </span>
        ) : (
          <select
            className="method-select"
            value={(requestData?.method || api.method || "get").toLowerCase()}
            onChange={e => updateField("method", e.target.value as Method)}
            title="HTTP Method (temporary override)"
            style={{ background: methodColor[(requestData?.method || api.method || "get").toLowerCase()] || "#888" }}
          >
            {(["get", "post", "put", "delete", "patch", "head", "options", "trace"] as Method[]).map(m => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
        )}
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

      <div style={{ padding: "0 8px 8px" }}>
        <div className="tab-bar" style={{ gap: 8 }}>
          {TAB_OPTIONS.map(tab => (
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
            <div className="apitest-body-wrapper">
              <BodyView
                value={typeof requestData?.body === "string"
                  ? requestData?.body
                  : formatBody(requestData?.format || "json", requestData?.body || {})
                }
                format={requestData?.format || "json"}
                mode="live"
                onChange={val => {
                  updateField("body", val);
                }}
              />
            </div>
          </>
        )}

        {shouldShowInputs() && (
          <>
            {examples.length > 0 && (
              <div style={{ paddingBottom: 20, width: "100%" }}>
                <div className="label">Predefined inputs</div>
                <div>
                  <select
                    value={selectedExampleIdx ?? ""}
                    onChange={e => {
                      const newIdx = Number(e.target.value);
                      handleExampleChange(newIdx);
                    }}
                    style={{ width: "100%" }}
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
                </div>
              </div>
            )}
            <VEditor
              label="Inputs"
              value={currentInputs}
              onChange={(data) => {
                setCurrentInputs(data);
                prepareRequestData(data, { respectTouched: false });
              }}
              keyOptions={typeof api.inputs === "object" ? Object.keys(api.inputs || {}) : []}
              deletable={false}
            />
          </>
        )}
      </div>

      <div className="apitest-send-row">
        <div className="apitest-send-controls">
          {isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url) && (
            <ConnectButton
              connected={network.connected}
              onClick={handleConnect}
            />
          )}
          <SendButton
            onClick={handleSend}
            onCancel={handleCancel}
            disabled={isDisplayedUrlWebSocket(requestData?.protocol || undefined, requestData?.url) && !network.connected}
            loading={network.loading}
          />
        </div>
        <div className="horizontal-line horizontal-line--below" />
      </div>

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

        {shouldShowResponse() && (
          <>
            <div className="label">Response Body</div>
            <div className="apitest-body-wrapper">
              <BodyView
                value={
                  responseData?.body === null || responseData?.body === undefined
                    ? ""
                    : typeof responseData?.body === "string"
                      ? responseData?.body
                      : JSON.stringify(responseData?.body, null, 2)
                }
                format={requestData?.format || "json"}
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
          />
        )}
      </div>

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
            />
          )}

          {(responseData?.status) && (
            <button
              onClick={async (e) => {
                e.currentTarget.blur();
                const newExampleNameBase = "example";
                let newName = newExampleNameBase;
                const nameSet = new Set((api.examples || []).map(e => (e?.name || "").toLowerCase()));
                let counter = 1;
                while (nameSet.has(newName.toLowerCase())) {
                  newName = `${newExampleNameBase}${counter++}`;
                }
                const newExample: any = { name: newName };
                if (Object.keys(currentInputs).length) newExample.inputs = currentInputs;

                const outputsWithStatus: JSONRecord = { ...outputs };

                if (requestData?.protocol !== "ws" && typeof responseData?.status === "number") {
                  outputsWithStatus.status_code = responseData.status;
                }

                if (Object.keys(outputsWithStatus).length) newExample.outputs = outputsWithStatus;

                const updatedExamples = [...(api.examples || []), newExample];
                onUpdateApi?.({ examples: updatedExamples });
              }}
              className="toolbar-button"
              title="Add example from current inputs and outputs"
            >
              <span style={{ position: "relative" }}>
                <span className="codicon codicon-lightbulb-autofix toolbar-button-icon"></span>
              </span>
            </button>
          )}
          <button
            onClick={() => {
              showHistoryPanel();
            }}
            className="toolbar-button"
            title="Show History Panel"
          >
            <span className="codicon codicon-history toolbar-button-icon"></span>
          </button>
          {api.protocol === "http" && (
            <button
              onClick={() => {
                const curl = buildCurl();
                window.vscode?.postMessage({
                  command: "runCurlCommand",
                  curl
                });
              }}
              className="toolbar-button"
              title="run in terminal using curl"
            >
              <span className="codicon codicon-terminal toolbar-button-icon"></span>
            </button>
          )}
          <button
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
            className={`toolbar-button ${autoFormatBody ? "toolbar-button--toggle-active" : ""}`}
            title={`Auto-format (beautify) body ${autoFormatBody ? "on" : "off"}`}
          >
            <span className="codicon codicon-sparkle-filled toolbar-button-icon"></span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default APITest;