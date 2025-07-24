import React, { useState, useRef, useEffect, useCallback } from "react";
import { InterfaceData, APIData } from "./APIData";
import KVEditor from "../components/KVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "../markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { useNetwork } from "../components/network/Network";
import { replaceAllRefs } from "../variableReplacer";
import EndpointInput from "../components/EndpointInput";


interface APITestProps {
  api: APIData;
}

const APITest: React.FC<APITestProps> = ({ api }) => {
  const interfaces = api.interfaces || [];
  const examples = api.examples || [];
  const [body, setBody] = useState<string>("");
  const [selectedInterfaceIdx, setSelectedInterfaceIdx] = useState<number>(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(0);

  const network = useNetwork();

  const req = network.requestData || {};

  // Only call onChange if endpoint value actually changed
  const handleEndpointChange = useCallback(
    (newEndpoint: string) => {
      if (newEndpoint !== req.endpoint) {
        req.endpoint = newEndpoint;
      }
    },
    [req.endpoint, req.params]
  );

  // Only call onChange if query value actually changed
  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      // Compare stringified versions for shallow equality
      const prev = JSON.stringify(req.params || {});
      const next = JSON.stringify(query || {});
      if (prev !== next) {
        network.setRequestData({
          ...network.requestData,
          params: query,
        });
      }
    },
    [req.endpoint, req.params]
  );
  
  useEffect(() => {
    const iface = { ...interfaces[selectedInterfaceIdx] };
    const selectedExample = examples[selectedExampleIdx] || {};
    iface.body = formatBody(iface.format || "json", iface.body || "")
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
        {/* Example select */}
        {examples.length > 0 && (
          <tr>
            <td className="label">example</td>
            <td style={{ padding: "8px" }}>
              <select
                value={selectedExampleIdx ?? ""}
                onChange={e => {
                  setSelectedExampleIdx(0);
                  setSelectedExampleIdx(Number(e.target.value));
                }
                }
                style={{ width: "100%" }}
              >
                <option value="default">defaults</option>
                {examples.map((ex, idx) => (
                  <option key={ex.name || idx} value={idx}>
                    {ex.name || `Example ${idx + 1}`}
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
              }
              }
              style={{ width: "100%" }}
            >
              {Array.isArray(interfaces) && interfaces.filter(Boolean).map((iface, idx) => (
                <option key={iface?.name || idx} value={idx}>
                  {iface?.name || `Interface ${idx + 1}`}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td className="label">endpoint</td>
          <td style={{ padding: "8px" }}>
            <EndpointInput
              endpoint={req.endpoint ?? ""}
              query={req.params || {}}
              onEndpointChange={handleEndpointChange}
              onQueryChange={handleQueryChange}
            />
          </td>
        </tr>
        <KVEditor
          label="url params"
          value={req.params || {}}
          onChange={query => updateField("query", query)}
        />
        <KVEditor
          label="headers"
          value={req.headers || {}}
          onChange={headers => updateField("headers", headers)}
        />
        <KVEditor
          label="cookies"
          value={req.cookies || {}}
          onChange={cookies => updateField("cookies", cookies)}
        />
        <tr>
          <td className="label">body</td>
          <td style={{ padding: "8px" }}>
            <BodyView
              value={body}
              format={req.format || "json"}
              mode="live"
              onChange={val => {
                setBody(val);
                updateField("body", val);
              }}
            />
          </td>
        </tr>
        <tr>
          <td colSpan={2} style={{ position: "relative", padding: 0, height: 40 }}>
            <div
              style={{
                borderTop: "1px solid #ccc",
                opacity: 0.2,
                position: "absolute",
                top: "50%",
                left: 0,
                width: "100%",
                height: 0,
              }}
            />
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
                {/* <img
                  src={errorImage}
                  alt="Error"
                  style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.7 }}
                /> */}
                <div style={{ color: "#d32f2f", fontSize: 12, textAlign: "center" }}>
                  {network.error}
                </div>
              </div>
            </td>
          </tr>
        ) : (
          <>
            {Object.keys(network.responseHeaders || {}).length > 0 && (
              <KVEditor
                label="headers"
                value={network.responseHeaders}
                onChange={headers => { }}
              />
            )}
            {Object.keys(network.responseCookies || {}).length > 0 && (
              <KVEditor
                label="cookies"
                value={network.responseCookies}
                onChange={cookies => { }}
              />
            )}
            <tr>
              <td className="label">response</td>
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
          </>
        )}
      </tbody>
    </table>
  );
};

export default APITest;