import React, { useState, useRef, useEffect, useCallback } from "react";
import { InterfaceData, APIData } from "./APIData";
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
  // Load existing environment variables
  const cleanup = loadEnvVariables((existingVars) => {
    const existing = Array.isArray(existingVars) ? existingVars : [];
    let updated = [...existing];

    // Handle setenv as object instead of array
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
                label: api.title ? `api(${api.title})` : envKey,
                value: String(outputValue)
              });
            }
          } else {
            // Direct value assignment (not from outputs)
            updated.push({
              name: envKey,
              label: api.title ? `api(${api.title})` : envKey,
              value: outputKey
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
  // Add safety checks for arrays
  const interfaces = safeList(api.interfaces);
  const examples = safeList(api.examples);

  const [body, setBody] = useState<string>("");
  const [selectedInterfaceIdx, setSelectedInterfaceIdx] = useState<number>(0);
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

  // Update outputs when response changes
  useEffect(() => {
    // Check if outputs exist as object instead of array
    if (
      (!api.outputs || Object.keys(api.outputs).length === 0) || (
        (!network.responseBody || network.responseBody == "") &&
        (!network.responseHeaders || Object.keys(network.responseHeaders).length === 0) &&
        (!network.responseCookies || Object.keys(network.responseCookies).length === 0))
    ) {
      return;
    }

    const iface = { ...interfaces[selectedInterfaceIdx] };

    // Handle interface outputs as object instead of array
    const ifaceOutputsDef = iface.outputs || {};

    // Get all API output keys - now it's an object
    const apiOutputsDef = api.outputs || {};
    const apiOutputKeys = Object.keys(apiOutputsDef);

    // Extract outputs for interface-defined keys only
    const ifaceOutputsExtracted = extractOutputs({
      type: network.responseHeaders?.["Content-Type"] ||
        network.responseHeaders?.["content-type"]?.includes("xml") ||
        (network.responseBody && network.responseBody.startsWith && network.responseBody.startsWith("<")) ? "xml" : "json",
      body: network.responseBody,
      headers: network.responseHeaders || {},
      cookies: network.responseCookies || {}
    }, ifaceOutputsDef);

    // Create final outputs with all API keys, filled with interface values where available
    const finalOutputs: Record<string, string | number | boolean> = {};

    apiOutputKeys.forEach(key => {
      if (key in ifaceOutputsExtracted) {
        finalOutputs[key] = ifaceOutputsExtracted[key];
      } else {
        finalOutputs[key] = ""; // Empty value for keys not defined in interface
      }
    });

    setOutputs(finalOutputs);

    // Handle setenv - set environment variables based on API configuration
    handleSetEnvVariables(api, finalOutputs);
  }, [network.responseBody, network.responseHeaders, network.responseCookies, api.outputs, interfaces, selectedInterfaceIdx, api.setenv]);

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
    const iface = { ...interfaces[selectedInterfaceIdx] };
    const selectedExample = examples[selectedExampleIdx] || {};
    iface.body = iface.body ? formatBody(iface.format || "json", iface.body || "") : ""

    loadEnvVariables(envVars => {
      const envParameters: JSONRecord = safeList(envVars).reduce((acc, envVar) => {
        acc[envVar.name] = envVar.value;
        return acc;
      }, {} as JSONRecord);

      let replaced = replaceAllRefs(
        iface,
        api?.inputs ?? {},
        selectedExample?.inputs ?? {},
        envParameters
      );
      setBody(replaced.body);
      network.setRequestData(replaced);
    });

  }, [api, selectedInterfaceIdx, selectedExampleIdx]);

  const updateField = (field: keyof InterfaceData, value: any) => {
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case 'loadDocument':
          if (message.viewMode) {
            setViewMode(message.viewMode);
          }
          break;

        case 'multimeter.mmt.show.panel':
          setViewMode(message.panelId);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (interfaces.length === 0) {
    return <div style={{ color: "#888" }}>No interfaces defined.</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Example select - with additional safety checks */}
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


      <div className="label">interface</div>
      <div style={{ padding: "8px" }}>
        <select
          value={selectedInterfaceIdx}
          onChange={e => {
            setSelectedInterfaceIdx(-1);
            setSelectedInterfaceIdx(Number(e.target.value));
          }}
          style={{ width: "100%" }}
        >
          {safeList(interfaces)
            .filter(Boolean) // Remove null/undefined entries
            .filter(iface => iface && typeof iface === 'object') // Ensure it's an object
            .map((iface, idx) => (
              <option key={iface?.name || idx} value={idx}>
                {iface?.name || `Interface ${idx + 1}`}
              </option>
            ))}
        </select>
      </div>


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
              </div>
            </div>
          </div>
        </>)}
    </div >
  );
};

export default APITest;