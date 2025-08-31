import React, { useState, useRef, useEffect, useCallback } from "react";
import { APIData } from "./APIData";
import KVEditor from "../components/KVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "../markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { useNetwork } from "../components/network/Network";
import { replaceAllRefs } from "../variableReplacer";
import UrlInput from "../components/UrlInput";
import { extractOutputs } from "./outputExtractor";
import ViewSelector, { ViewMode } from "../components/ViewSelector";
import { loadEnvVariables } from "../workspaceStorage";
import { safeList } from "../safer";
import { Request, Response } from "../components/network/NetworkData";
import { JSONRecord } from "../CommonData";
import { setEnvironmentVariable, getEnvironmentVariable } from "../environment/environmentUtils";

interface APITestProps {
  api: APIData;
}

const APITest: React.FC<APITestProps> = ({ api }) => {
  const examples = safeList(api.examples);

  const [body, setBody] = useState<string>("");
  const [requestData, setRequestData] = useState<Request>({ url: "", query: {}, headers: {}, cookies: {}, method: "", format: "json" });
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
  const req = requestData || {};

  // Outputs state
  const [outputs, setOutputs] = useState<JSONRecord>({});

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
      type: responseData?.headers?.["Content-Type"] ||
        responseData?.headers?.["content-type"]?.includes("xml") ||
        (responseData?.body && responseData.body.startsWith && responseData.body.startsWith("<")) ? "xml" : "json",
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
      if (newUrl !== req.url) {
        req.url = newUrl;
      }
    },
    [req.url, req.query]
  );

  // Only call onChange if query value actually changed
  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      const prev = JSON.stringify(req.query || {});
      const next = JSON.stringify(query || {});
      if (prev !== next) {
        setRequestData({
          ...requestData,
          query: query
        });
      }
    },
    [req.url, req.query]
  );

  useEffect(() => {
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

      let rface = replaceAllRefs(
        api,
        api?.inputs ?? {},
        selectedExample?.inputs ?? {},
        envParameters
      );

      rface.body = formatBody(rface.format || "json", rface.body || "");

      // Only update body if it actually changed to avoid feedback loop
      setBody(prevBody => {
        if (prevBody !== (rface.body || "")) {
          return rface.body || "";
        }
        return prevBody;
      });

      setRequestData(rface);
    })();
  }, [api, selectedExampleIdx]);

  const updateField = (field: keyof APIData, value: any) => {
    setRequestData({
      ...requestData,
      [field]: value,
    });
  };

  const handleSend = async () => {
    network.send(requestData, setResponseData);
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
      network.connectWs(req.url || "", setResponseData);
    }
  };

  // Helper functions to check what should be visible based on view mode
  const shouldShowQuery = () => viewMode === "all";
  const shouldShowHeaders = () => viewMode === "all";
  const shouldShowCookies = () => viewMode === "all";
  const shouldShowBody = () => !req.method || req.method.toLowerCase() !== "get";
  const shouldShowResponse = () => viewMode === "all" || viewMode === "body";
  const shouldShowResponseHeaders = () => (viewMode === "all") && Object.keys(responseData?.headers || {}).length > 0;
  const shouldShowResponseCookies = () => (viewMode === "all") && Object.keys(responseData?.cookies || {}).length > 0;
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
          url={req.url ?? ""}
          query={req.query || {}}
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
        value={req.query || {}}
        onChange={query => updateField("query", query)}
      />}
      {shouldShowHeaders() && < KVEditor
        label="headers"
        value={req.headers || {}}
        onChange={headers => updateField("headers", headers)}
      />}
      {shouldShowCookies() && <KVEditor
        label="cookies"
        value={req.cookies || {}}
        onChange={cookies => updateField("cookies", cookies)}
      />}

      {shouldShowBody() && (
        <>
          <div className="label">body</div>
          <div style={{ padding: "8px" }}>
            <BodyView
              value={body == null ? "" : body}
              format={req.format || "json"}
              mode="live"
              onChange={val => {
                setBody(val);
                updateField("body", val);
              }}
            />
          </div>
        </>
      )}

      <div style={{ position: "relative", paddingTop: 0, paddingBottom: 8, height: 40 }}>
        <div className="horizontal-line" />
        {req.protocol === "ws" && (
          <ConnectButton
            connected={network.connected}
            onClick={handleConnect}
          />
        )}
        <SendButton
          onClick={handleSend}
          onCancel={handleCancel}
          disabled={req.protocol === "ws" && !network.connected}
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
              format={req.format || "json"}
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
                  gap: '4px',
                }}
              >
                {responseData.duration || -1 >= 0 && (
                  <div
                    style={{
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '20px',
                    }}
                  >
                    {responseData.duration}ms
                  </div>
                )}

                {/* {responseData?.error && (
                  <div
                    style={{
                      backgroundColor: '#d32f2f',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      minWidth: '20px',
                      textAlign: 'center',
                    }}
                    title={`${responseData?.error.message || 'Unknown error'}${responseData?.error.status ? ` (Status: ${responseData?.error.status})` : ''
                      }${responseData?.error.code ? ` (Code: ${responseData?.error.code})` : ''}`}
                  >
                    {responseData?.error.status || responseData?.error.code || 'ERROR'}
                  </div>
                )}
                {responseData?.status && responseData?.status > 0 && !responseData?.error && (
                  <div
                    style={{
                      backgroundColor: '#4caf50',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '40px',
                      textAlign: 'center',
                    }}
                    title="Request successful"
                  >
                    {responseData?.statusCode}
                  </div>
                )} */}
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