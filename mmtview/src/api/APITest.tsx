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
import { isList, safeList, toKVList, toKVObject } from "../safer";

interface APITestProps {
  api: APIData;
}

// Function to handle setting environment variables from API setenv configuration
const handleSetEnvVariables = (
  api: APIData,
  finalOutputs: Record<string, string | number | boolean>
) => {
  if (!isList(api.setenv)) {
    return;
  }
  // Load existing environment variables
  const cleanup = loadEnvVariables((existingVars) => {
    const existing = Array.isArray(existingVars) ? existingVars : [];
    let updated = [...existing];

    safeList(api.setenv).forEach((envVar: { [key: string]: string }) => {
      const envKey = Object.keys(envVar)[0];
      const outputKey = envVar[envKey];
      if (envKey && outputKey) {
        // Remove existing variable with same name first
        updated = updated.filter(v => v.name !== envKey);

        // Check if the value refers to an output
        if (outputKey in finalOutputs) {
          const outputValue = finalOutputs[outputKey];
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
  const [outputs, setOutputs] = useState<Record<string, string | number | boolean>>({});

  // Update outputs when response changes
  useEffect(() => {
    if (
      network.responseBody ||
      network.responseHeaders ||
      network.responseCookies
    ) {
      const iface = { ...interfaces[selectedInterfaceIdx] };
      const ifaceOutputsDef = safeList(iface.outputs).reduce((acc, cur) => ({ ...acc, ...cur }), {});

      // Get all API output keys
      const apiOutputsDef = safeList(api.outputs).reduce((acc, cur) => ({ ...acc, ...cur }), {});
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

    } else {
      setOutputs({});
    }
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
          query: toKVList(query)
        });
      }
    },
    [req.url, req.query]
  );

  useEffect(() => {
    const iface = { ...interfaces[selectedInterfaceIdx] };
    const selectedExample = examples[selectedExampleIdx] || {};
    iface.body = iface.body ? formatBody(iface.format || "json", iface.body || "") : ""
    replaceAllRefs(iface, api?.inputs ?? [], selectedExample?.inputs ?? [], (replaced) => {
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
    network.clearRespond();
    await network.send();
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

  if (interfaces.length === 0) {
    return <div style={{ color: "#888" }}>No interfaces defined.</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "80%" }} />
      </colgroup>
      <tbody>
        {/* Example select - with additional safety checks */}
        {examples.length > 0 && (
          <tr>
            <td className="label">example</td>
            <td style={{ padding: "8px" }}>
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
                  .filter(ex => ex && typeof ex === 'object') // Filter out invalid entries
                  .map((ex, idx) => (
                    <option key={ex?.name || idx} value={idx}>
                      {ex?.name || `Example ${idx + 1}`}
                    </option>
                  ))}
              </select>
            </td>
          </tr>
        )}

        <tr>
          <td className="label">interface</td>
          <td style={{ padding: "8px" }}>
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
          </td>
        </tr>
        <tr>
          <td className="label">url</td>
          <td style={{ padding: "8px" }}>
            <UrlInput
              url={req.url ?? ""}
              query={toKVObject(req.query || {})}
              onUrlChange={handleUrlChange}
              onQueryChange={handleQueryChange}
            />
          </td>
        </tr>
        <tr style={{ zIndex: 100, position: "relative", padding: 0 }}>
          <td colSpan={2} style={{ position: "relative", paddingTop: 0, paddingBottom: 8, height: 40 }}>
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
          </td>
        </tr>
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "4px",
        }}>
        </div>
        {shouldShowQuery() && <KVEditor
          label="query"
          value={toKVObject(req.query || {})}
          onChange={query => updateField("query", toKVList(query))}
        />}
        {shouldShowHeaders() && (< KVEditor
          label="headers"
          value={toKVObject(req.headers || {})}
          onChange={headers => updateField("headers", toKVList(headers))}
        />)}
        {shouldShowCookies() && <KVEditor
          label="cookies"
          value={toKVObject(req.cookies || {})}
          onChange={cookies => updateField("cookies", toKVList(cookies))}
        />}

        {/* Only show body editor if method is not get */}
        {shouldShowBody() && (
          <tr>
            <td className="label">body</td>
            <td style={{ padding: "8px" }}>
              <BodyView
                value={body == null ? "" : body}
                format={req.format || "json"}
                mode="live"
                onChange={val => {
                  setBody(val);
                  updateField("body", val);
                }}
              />
            </td>
          </tr>
        )}

        <tr>
          <td colSpan={2} style={{ position: "relative", padding: 0, height: 40 }}>
            <div className="horizontal-line" />
            {req.protocol === "ws" && (
              <ConnectButton
                connected={network.connected}
                onClick={handleConnect}
              />
            )}
            <SendButton
              onClick={handleSend}
              disabled={req.protocol === "ws" && !network.connected}
              loading={network.loading}
            />
          </td>
        </tr>

        {/* Error and Response Section */}
        {network.error ? (
          <tr>
            <td colSpan={2} style={{ padding: "32px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ color: "#d32f2f", fontSize: 12, textAlign: "center" }}>
                  {network.error}
                </div>
              </div>
            </td>
          </tr>
        ) : (
          <>
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
              <tr>
                <td className="label">body</td>
                <td style={{ padding: "8px" }}>
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
                </td>
              </tr>
            )}

            {shouldShowOutputs() && (
              <KVEditor
                label="outputs"
                value={Object.fromEntries(
                  safeList(Object.entries(outputs)).map(([k, v]) => [k, String(v)])
                )}
                onChange={() => { }}
                deactivated={true}
              />
            )}
          </>
        )}
      </tbody>
    </table>
  );
};

export default APITest;