import React, { useState, useContext } from "react";
import { APIData } from "mmt-core/APIData";
import { JSONRecord } from "mmt-core/CommonData";
import KSVEditor from "../components/KSVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "mmt-core/markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import UrlInput from "../components/UrlInput";
import ViewSelector, { ViewMode } from "../components/ViewSelector";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";
import VEditor from "../components/VEditor";
import { FileContext } from "../fileContext";
import { showHistoryPanel } from "../vsAPI";
import { useAPITesterLogic } from "./useAPITesterLogic";

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
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

const APITest: React.FC<APITestProps> = ({ api, onUpdateApi }) => {
  const { filePath } = useContext(FileContext);
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
  } = useAPITesterLogic({ api, onUpdateApi, filePath });

  // View state with localStorage persistence
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("apitest-view-mode");
    return (saved as ViewMode) || "all";
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("apitest-view-mode", mode);
  };

  const shouldShowQuery = () => viewMode === "all" || viewMode === "params";
  const shouldShowHeaders = () => viewMode === "all" || viewMode === "headers";
  const shouldShowCookies = () => viewMode === "all" || viewMode === "cookies";
  const shouldShowBody = () => (viewMode === "all" || viewMode === "body") && (!requestData?.method || requestData?.method.toLowerCase() !== "get");
  const shouldShowResponse = () => (viewMode === "all" || viewMode === "body");
  const shouldShowResponseHeaders = () => (viewMode === "all" || viewMode === "headers") && Object.keys(responseData?.headers || {}).length > 0;
  const shouldShowResponseCookies = () => (viewMode === "all" || viewMode === "cookies") && Object.keys(responseData?.cookies || {}).length > 0;
  const shouldShowInputs = () => (viewMode === "all" || viewMode === "in/out") && Object.keys(api.inputs || {}).length > 0;
  const shouldShowOutputs = () => (viewMode === "all" || viewMode === "in/out") && Object.keys(outputs).length > 0;

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
    <div style={{ width: "100%" }}>
      {examples.length > 0 && (
        <>
          <div className="label">example</div>
          <div style={{ padding: "8px" }}>
            <select
              value={selectedExampleIdx ?? ""}
              onChange={e => {
                const newIdx = Number(e.target.value);
                handleExampleChange(newIdx);
              }}
              style={{ width: "100%" }}
            >
              <option value={-1}>defaults</option>
              {examples
                .filter(ex => ex && typeof ex === "object")
                .map((ex, idx) => (
                  <option key={ex?.name || idx} value={idx}>
                    {ex?.name || `Example ${idx + 1}`}
                  </option>
                ))}
            </select>
          </div>
        </>
      )}

      <div className="label">url</div>
      <div style={{ padding: "8px" }}>
        <UrlInput
          url={requestData?.url ?? ""}
          query={requestData?.query || {}}
          onUrlChange={handleUrlChange}
          onQueryChange={handleQueryChange}
        />
      </div>

      <div style={{ position: "relative", paddingTop: 0, paddingBottom: 8, height: 30 }}>
        <div className="horizontal-line" />
        <div style={{
          position: "absolute",
          right: 8,
          top: "80%",
          transform: "translateY(-50%)",
          zIndex: 100
        }}>
          <ViewSelector
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {shouldShowQuery() && <KSVEditor
        label="query"
        value={requestData?.query || {}}
        onChange={query => updateField("query", query)}
      />}
      {shouldShowHeaders() && < KSVEditor
        label="headers"
        value={requestData?.headers || {}}
        onChange={headers => updateField("headers", headers)}
      />}
      {shouldShowCookies() && <KSVEditor
        label="cookies"
        value={requestData?.cookies || {}}
        onChange={cookies => updateField("cookies", cookies)}
      />}
      {shouldShowBody() && (
        <>
          <div className="label">body</div>
          <div style={{ padding: "8px" }}>
            <BodyView
              value={typeof requestData?.body === 'string'
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
        <VEditor
          label="inputs"
          value={currentInputs}
          onChange={(data) => {
            setCurrentInputs(data);
            prepareRequestData(data, { respectTouched: false });
          }}
          keyOptions={Object.keys(api.inputs || {})}
          deletable={false}
        />
      )}

      <div style={{ position: "relative", paddingTop: 0, paddingBottom: 8, height: 40 }}>
        <div className="horizontal-line" />
        {requestData?.protocol === "ws" && (
          <ConnectButton
            connected={network.connected}
            onClick={handleConnect}
          />
        )}
        <SendButton
          onClick={handleSend}
          onCancel={handleCancel}
          disabled={requestData?.protocol === "ws" && !network.connected}
          loading={network.loading}
        />
      </div>


      {shouldShowResponseHeaders() && (
        <KSVEditor
          label="headers"
          value={responseData?.headers || {}}
          onChange={headers => { }}
          deactivated={true}
        />
      )}

      {shouldShowResponseCookies() && (
        <KSVEditor
          label="cookies"
          value={responseData?.cookies || {}}
          onChange={cookies => { }}
          deactivated={true}
        />
      )}

      {shouldShowResponse() && (
        <>
          <div className="label">body</div>
          <div style={{ padding: "8px" }}>
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
          label="outputs"
          value={outputs}
          onChange={() => { }}
          keyOptions={Object.keys(api.outputs || {})}
          deletable={false}
        />
      )}

      <div className="horizontal-line" style={{ position: "relative", padding: 4, height: 1 }} />

      <div style={{ position: 'relative', height: 20 }}>
        <div style={{ padding: 0, height: 20, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '4px',
              height: '12px'
            }}
          >
            {(responseData?.status) && <ResponseDuration duration={responseData.duration} />}
            {(responseData?.status) && (
              <ResponseStatus
                status={responseData.status}
                errorMessage={responseData.errorMessage}
                errorCode={responseData.errorCode}
              />
            )}

            {(responseData?.status) && (<button
              onClick={async (e) => {
                e.currentTarget.blur();
                // Build example from current inputs and extracted outputs
                const newExampleNameBase = 'example';
                let newName = newExampleNameBase;
                const nameSet = new Set((api.examples || []).map(e => (e?.name || '').toLowerCase()));
                let counter = 1;
                while (nameSet.has(newName.toLowerCase())) {
                  newName = `${newExampleNameBase}${counter++}`;
                }
                const newExample: any = { name: newName };
                if (Object.keys(currentInputs).length) newExample.inputs = currentInputs;

                // Start with current extracted outputs
                const outputsWithStatus: JSONRecord = { ...outputs };

                // For HTTP requests, also capture status_code in outputs
                if (requestData?.protocol !== 'ws' && typeof responseData?.status === 'number') {
                  outputsWithStatus.status_code = responseData.status;
                }

                if (Object.keys(outputsWithStatus).length) newExample.outputs = outputsWithStatus;

                const updatedExamples = [...(api.examples || []), newExample];
                onUpdateApi?.({ examples: updatedExamples });
              }}
              className="toolbar-button"
              title="Add example from current inputs and outputs"
            >
              <span style={{ position: 'relative' }}>
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
            {api.protocol === 'http' && (
              <button
                onClick={() => {
                  const curl = buildCurl();
                  window.vscode?.postMessage({
                    command: 'runCurl',
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
                  command: 'updateConfig',
                  section: 'multimeter',
                  key: 'body.auto.format',
                  value: next,
                });
              }}
              className={`toolbar-button ${autoFormatBody ? 'toolbar-button--toggle-active' : ''}`}
              title={`Auto-format (beautify) body ${autoFormatBody ? 'on' : 'off'}`}
            >
              <span className="codicon codicon-sparkle-filled toolbar-button-icon"></span>
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default APITest;