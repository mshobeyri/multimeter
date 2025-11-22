import React, { useState, useEffect, useCallback, useMemo } from "react";
import { APIData } from "mmt-core/APIData";
import KVEditor from "../components/KVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "mmt-core/markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { useNetwork } from "../components/network/Network";
import { replaceAllRefs } from "mmt-core/variableReplacer";
import UrlInput from "../components/UrlInput";
import { extractOutputs } from "mmt-core/outputExtractor";
import ViewSelector, { ViewMode } from "../components/ViewSelector";
import { loadEnvVariables } from "../workspaceStorage";
import { safeList } from "mmt-core/safer";
import { Request, Response } from "mmt-core/NetworkData";
import { JSONRecord } from "mmt-core/CommonData";
import { setEnvironmentVariable, getEnvironmentVariable } from "../environment/environmentUtils";
import ResponseDuration from "../components/ResponseDuration";
import ResponseStatus from "../components/ResponseStatus";

interface APITestProps {
  api: APIData;
  onUpdateApi?: (patch: Partial<APIData>) => void;
}

const APITest: React.FC<APITestProps> = ({ api, onUpdateApi }) => {
  const examples = safeList(api.examples);
  const [requestData, setRequestData] = useState<Request>();

  const updateField = (field: keyof Request, value: any) => {
    setRequestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const [responseData, setResponseData] = useState<Response>();
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(0);

  // View state with localStorage persistence
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("apitest-view-mode");
    return (saved as ViewMode) || "all";
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("apitest-view-mode", mode);
  };

  const network = useNetwork();

  // Config state: whether to auto-format request body
  const [autoFormatBody, setAutoFormatBody] = useState<boolean>(false);

  // Outputs state
  const [outputs, setOutputs] = useState<JSONRecord>({});

  // Display inputs state: all api inputs with resolved values
  const [displayInputs, setDisplayInputs] = useState<JSONRecord>({});

  // Update outputs when response changes using extracts
  useEffect(() => {
    if (
      (!api.extract || Object.keys(api.extract).length === 0) || (
        (!responseData?.body || responseData.body == "") &&
        (!responseData?.headers || Object.keys(responseData.headers).length === 0) &&
        (!responseData?.cookies || Object.keys(responseData.cookies).length === 0))
    ) {
      return;
    }

    const extractRules = api.extract || {};
    const outputNames = Object.keys(extractRules);

    const extractedValues = extractOutputs({
      type: 'auto',
      body: responseData?.body,
      headers: responseData?.headers || {},
      cookies: responseData?.cookies || {}
    }, extractRules);

    const finalOutputs: JSONRecord = {};
    outputNames.forEach(outputName => {
      if (outputName in extractedValues) {
        finalOutputs[outputName] = extractedValues[outputName];
      } else {
        finalOutputs[outputName] = "";
      }
    });

    setOutputs(finalOutputs);
    handleSetEnvVariables(api, finalOutputs);
  }, [responseData?.body, responseData?.headers, responseData?.cookies, api.outputs, api.extract, api.setenv]);

  // Only call onChange if url value actually changed
  const handleUrlChange = useCallback(
    (newUrl: string) => {
      if (newUrl !== requestData?.url) {
        setRequestData(prev => ({
          ...prev,
          url: newUrl
        }));
      }
    },
    [requestData?.url, requestData?.query]
  );

  // Only call onChange if query value actually changed
  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      const prev = JSON.stringify(requestData?.query || {});
      const next = JSON.stringify(query || {});
      if (prev !== next) {
        updateField("query", query);
      }
    },
    [requestData?.url, requestData?.query]
  );

  const prepareRequestData = () => {
    const selectedExample = examples[selectedExampleIdx] || {};
    (async () => {
      const envVars = await new Promise(resolve => {
        const cleanup = loadEnvVariables(vars => {
          cleanup();
          resolve(vars);
        });
      });

      const envParameters: JSONRecord = safeList(envVars).reduce((acc, envVar) => {
        acc[envVar.name] = envVar.value;
        return acc;
      }, {} as JSONRecord);

      const resolvedInputsObj = replaceAllRefs({ inputs: api.inputs || {} }, api.inputs || {}, selectedExample?.inputs ?? {}, envParameters).inputs;
      setDisplayInputs(resolvedInputsObj);

      let rface = replaceAllRefs(
        api,
        api?.inputs ?? {},
        selectedExample?.inputs ?? {},
        envParameters
      );

      if (autoFormatBody) {
        rface.body = formatBody(rface.format || "json", rface.body ?? "");
      }

      if ((rface.format === 'text' || !rface.format) && rface.body && typeof rface.body !== 'string') {
        rface.format = 'json';
        rface.body = formatBody('json', rface.body);
      }

      // Only update body if it actually changed to avoid feedback loop
      setRequestData(prevRequestData => {
        if (prevRequestData?.body !== (rface.body || "")) {
          return {
            ...prevRequestData,
            body: rface.body || ""
          };
        }
        return prevRequestData;
      });

      setRequestData(rface);
    })();
  }

  useEffect(() => {
    prepareRequestData();
  }, [api, selectedExampleIdx]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;
      switch (message.command) {
        case 'multimeter.environment.refresh':
          prepareRequestData();
          break;
        case 'config':
          if (typeof message.bodyAutoFormat === 'boolean') {
            setAutoFormatBody(message.bodyAutoFormat);
            // Rebuild request with new formatting preference
            prepareRequestData();
          }
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);


  const handleSend = async () => {
    const res = await network.send(requestData);
    setResponseData(res);
  };

  const handleCancel = async () => {
    setResponseData(undefined);
    await network.cancel();
  };

  const handleConnect = () => {
    setResponseData(undefined);
    if (network.connected) {
      network.closeWs();
    } else {
      network.connectWs(requestData?.url || "").then(setResponseData);
    }
  };

  // Helper functions to check what should be visible based on view mode
  const shouldShowQuery = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "params");
  const shouldShowHeaders = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "headers");
  const shouldShowCookies = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "cookies");
  const shouldShowBody = () => viewMode !== "in/out" && (!requestData?.method || requestData?.method.toLowerCase() !== "get");
  const shouldShowResponse = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "body");
  const shouldShowResponseHeaders = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "headers") && Object.keys(responseData?.headers || {}).length > 0;
  const shouldShowResponseCookies = () => viewMode !== "in/out" && (viewMode === "all" || viewMode === "cookies") && Object.keys(responseData?.cookies || {}).length > 0;
  const shouldShowInputs = () => (viewMode === "all" || viewMode === "in/out") && Object.keys(api.inputs || {}).length > 0;
  const shouldShowOutputs = () => (viewMode === "all" || viewMode === "in/out") && Object.keys(outputs).length > 0;

  return (
    <div style={{ width: "100%" }}>
      {examples.length > 0 && (
        <>
          <div className="label">example</div>
          <div style={{ padding: "8px" }}>
            <select
              value={selectedExampleIdx ?? ""}
              onChange={e => {
                setSelectedExampleIdx(0);
                setSelectedExampleIdx(Number(e.target.value));
              }}
              style={{ width: "100%" }}
            >
              <option value="default">defaults</option>
              {safeList(examples)
                .filter(ex => ex && typeof ex === 'object')
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

      {shouldShowQuery() && <KVEditor
        label="query"
        value={requestData?.query || {}}
        onChange={query => updateField("query", query)}
      />}
      {shouldShowHeaders() && < KVEditor
        label="headers"
        value={requestData?.headers || {}}
        onChange={headers => updateField("headers", headers)}
      />}
      {shouldShowCookies() && <KVEditor
        label="cookies"
        value={requestData?.cookies || {}}
        onChange={cookies => updateField("cookies", cookies)}
      />}
      {shouldShowInputs() &&
        <KVEditor
          label="inputs"
          value={displayInputs}
          onChange={() => { }}
          deactivated={true}
        />}


      {shouldShowBody() && (
        <>
          <div className="label">body</div>
          <div style={{ padding: "8px" }}>
            <BodyView
              value={typeof requestData?.body === 'string' ? requestData?.body : JSON.stringify(requestData?.body || {}, null, 2)}
              format={requestData?.format || (typeof requestData?.body === 'string' ? 'json' : 'json')}
              mode="live"
              onChange={val => {
                updateField("body", val);
              }}
            />
          </div>
        </>
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
        <KVEditor
          label="headers"
          value={responseData?.headers || {}}
          onChange={headers => { }}
          deactivated={true}
        />
      )}

      {shouldShowResponseCookies() && (
        <KVEditor
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
                responseData?.body == null
                  ? ""
                  : typeof responseData?.body === "string"
                    ? responseData?.body
                    : JSON.stringify(responseData?.body, null, 2)
              }
              format={requestData?.format || "json"}
              mode="live"
            />
          </div>
        </>
      )}

      {shouldShowOutputs() && (
        <KVEditor
          label="outputs"
          value={outputs}
          onChange={() => { }}
          deactivated={true}
        />
      )}
      {(responseData?.status) && (
        <>
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
                <ResponseDuration duration={responseData.duration} />
                <ResponseStatus
                  status={responseData.status}
                  errorMessage={responseData.errorMessage}
                  errorCode={responseData.errorCode}
                />
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
                  style={{
                    background: autoFormatBody ? '#0e639c' : 'transparent',
                    color: autoFormatBody ? '#fff' : 'var(--vscode-foreground, #ccc)',
                    border: '1px solid #2a2a2a',
                    borderRadius: '4px',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={`Auto-format (beautify) body ${autoFormatBody ? 'on' : 'off'}`}
                >
                  <span className="codicon codicon-sparkle-filled" style={{ fontSize: '12px' }}></span>
                </button>
                <button
                  onClick={() => {
                    window.vscode?.postMessage({
                      command: 'multimeter.history.show'
                    });
                  }}
                  style={{
                    background: "transparent",
                    borderRadius: "4px",
                    padding: "0px 0px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--vscode-foreground, #333)",
                  }}
                  title="Show History Panel"
                >
                  <span className="codicon codicon-history" style={{ fontSize: "12px" }}></span>
                </button>
                <button
                  onClick={async () => {
                    // Build example from current resolved inputs and extracted outputs
                    const newExampleNameBase = 'new example';
                    let newName = newExampleNameBase;
                    const nameSet = new Set((api.examples || []).map(e => (e?.name || '').toLowerCase()));
                    let counter = 2;
                    while (nameSet.has(newName.toLowerCase())) {
                      newName = `${newExampleNameBase}${counter++}`;
                    }
                    const newExample: any = { name: newName };
                    if (Object.keys(displayInputs).length) newExample.inputs = displayInputs;
                    if (Object.keys(outputs).length) newExample.outputs = outputs;
                    const updatedExamples = [...(api.examples || []), newExample];
                    onUpdateApi?.({ examples: updatedExamples });
                  }}
                  style={{
                    background: '#2d2d30',
                    color: '#ccc',
                    border: '1px solid #3a3a3a',
                    borderRadius: '4px',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Add example from current response"
                >
                  <span style={{ position: 'relative' }}>
                    <span className="codicon codicon-lightbulb-autofix" style={{ fontSize: '12px' }}></span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>)}
    </div >
  );
};


// Function to handle setting environment variables from API setenv configuration
const handleSetEnvVariables = async (
  api: APIData,
  finalOutputs: JSONRecord
) => {
  if (!api.setenv || typeof api.setenv !== 'object' || Object.keys(api.setenv).length === 0) {
    return;
  }
  await Promise.all(
    Object.entries(api.setenv).map(async ([envKey, outputKey]) => {
      if (envKey && outputKey) {
        let value = "";
        let label = api.title ? `api(${api.title}) - ${outputKey}` : envKey;

        if (finalOutputs.hasOwnProperty(String(outputKey))) {
          const outputValue = finalOutputs[String(outputKey)];
          if (outputValue !== "" && outputValue != null) {
            value = String(outputValue);
          }
        } else {
          // Direct value assignment (not from outputs)
          value = String(outputKey);
          label = api.title ? `api(${api.title})` : envKey;
        }

        // Optionally, avoid unnecessary writes:
        const currentValue = await getEnvironmentVariable(envKey);
        if (currentValue !== value) {
          setEnvironmentVariable(envKey, value, label);
        }
      }
    })
  );
};

export default APITest;