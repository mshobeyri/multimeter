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
import { saveEnvVariablesFromObject, loadEnvVariables } from "../workspaceStorage";
import { safeList } from "../safer";
import { JSONRecord } from "../CommonData";

interface APITestProps {
  api: APIData;
}

// Function to handle setting environment variables from API setenv configuration
const handleSetEnvVariables = (
  api: APIData,
  finalOutputs: JSONRecord
) => {
  if (!api.setenv || typeof api.setenv !== 'object' || Object.keys(api.setenv).length === 0) {
    return;
  }
  // Load existing environment variables
  const cleanup = loadEnvVariables((existingVars) => {
    const existing = Array.isArray(existingVars) ? existingVars : [];
    let updated = [...existing];

    // Handle setenv as object mapping env var names to output names
    if (api.setenv && typeof api.setenv === 'object') {
      Object.entries(api.setenv).forEach(([envKey, outputKey]) => {
        if (envKey && outputKey) {
          // Remove existing variable with same name first
          updated = updated.filter(v => v.name !== envKey);

          // Check if the value refers to an output
          if (finalOutputs.hasOwnProperty(String(outputKey))) {
            const outputValue = finalOutputs[String(outputKey)];
            if (outputValue !== "" && outputValue != null) {
              // Add new/updated variable with output value
              updated.push({
                name: envKey,
                label: api.title ? `api(${api.title}) - ${outputKey}` : envKey,
                value: String(outputValue)
              });
            }
          } else {
            // Direct value assignment (not from outputs)
            updated.push({
              name: envKey,
              label: api.title ? `api(${api.title})` : envKey,
              value: String(outputKey)
            });
          }
        }
      });
    }

    // Only save if there were changes
    if (updated.length !== existing.length ||
      JSON.stringify(updated) !== JSON.stringify(existing)) {
      saveEnvVariablesFromObject(updated);
    }

    cleanup(); // Clean up the subscription
  });
};

const APITest: React.FC<APITestProps> = ({ api }) => {
  const examples = safeList(api.examples);

  const [body, setBody] = useState<string>("");
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
  const req = network.requestData || {};

  // Outputs state
  const [outputs, setOutputs] = useState<JSONRecord>({});

  // Update outputs when response changes using extracts
  useEffect(() => {
    if (
      (!api.extract || Object.keys(api.extract).length === 0) || (
        (!network.responseBody || network.responseBody == "") &&
        (!network.responseHeaders || Object.keys(network.responseHeaders).length === 0) &&
        (!network.responseCookies || Object.keys(network.responseCookies).length === 0))
    ) {
      return;
    }

    // api.extract contains the extraction rules (key = output name, value = regex/path)
    const extractRules = api.extract || {};
    const outputNames = Object.keys(extractRules);

    const extractedValues = extractOutputs({
      type: network.responseHeaders?.["Content-Type"] ||
        network.responseHeaders?.["content-type"]?.includes("xml") ||
        (network.responseBody && network.responseBody.startsWith && network.responseBody.startsWith("<")) ? "xml" : "json",
      body: network.responseBody,
      headers: network.responseHeaders || {},
      cookies: network.responseCookies || {}
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
  }, [network.responseBody, network.responseHeaders, network.responseCookies, api.outputs, api.extract, api.setenv]);

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
      // Compare stringified versions for shallow equality
      const prev = JSON.stringify(req.query || {});
      const next = JSON.stringify(query || {});
      if (prev !== next) {
        network.setRequestData({
          ...network.requestData,
          query: query
        });
      }
    },
    [req.url, req.query]
  );

  useEffect(() => {
    const selectedExample = examples[selectedExampleIdx] || {};
    loadEnvVariables(envVars => {
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

      setBody(rface.body || "");
      network.setRequestData(rface);
    });

  }, [api, selectedExampleIdx]);

  const updateField = (field: keyof APIData, value: any) => {
    network.setRequestData({
      ...network.requestData,
      [field]: value,
    });
  };

  useEffect(() => {
    updateField("body", body);
  }, [body]);

  const handleSend = async () => {
    await network.send();
  };

  const handleCancel = async () => {
    network.clearRespond();
    await network.cancel();
  };

  const handleConnect = () => {
    network.clearRespond();
    if (network.connected) {
      network.closeWs();
    } else {
      network.connectWs();
    }
  };

  // Helper functions to check what should be visible based on view mode
  const shouldShowQuery = () => viewMode === "all";
  const shouldShowHeaders = () => viewMode === "all";
  const shouldShowCookies = () => viewMode === "all";
  const shouldShowBody = () => !req.method || req.method.toLowerCase() !== "get";
  const shouldShowResponse = () => viewMode === "all" || viewMode === "body";
  const shouldShowResponseHeaders = () => (viewMode === "all") && Object.keys(network.responseHeaders || {}).length > 0;
  const shouldShowResponseCookies = () => (viewMode === "all") && Object.keys(network.responseCookies || {}).length > 0;
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
          value={network.responseHeaders}
          onChange={headers => { }}
          deactivated={true}
        />
      )}

      {shouldShowResponseCookies() && (
        <KVEditor
          label="cookies"
          value={network.responseCookies}
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
                network.responseBody == null
                  ? ""
                  : typeof network.responseBody === "string"
                    ? network.responseBody
                    : JSON.stringify(network.responseBody, null, 2)
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
      {(network.statusCode || network.error) && (
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
                {network.duration >= 0 && (
                  <div
                    style={{
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '20px',
                    }}
                  >
                    {network.duration}ms
                  </div>
                )}

                {network.error && (
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
                    title={`${network.error.message || 'Unknown error'}${network.error.status ? ` (Status: ${network.error.status})` : ''
                      }${network.error.code ? ` (Code: ${network.error.code})` : ''}`}
                  >
                    {network.error.status || network.error.code || 'ERROR'}
                  </div>
                )}
                {network.statusCode && network.statusCode > 0 && !network.error && (
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
                    {network.statusCode}
                  </div>
                )}
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

export default APITest;