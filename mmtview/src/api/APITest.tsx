import React, { useState, useRef, useEffect } from "react";
import { InterfaceData, APIData } from "./APIData";
import KVEditor from "../components/KVEditor";
import BodyView from "../components/BodyView";
import { formatBody } from "../markupConvertor";
import SendButton from "../components/SendButton";
import ConnectButton from "../components/ConnectButton";
import { useNetwork } from "../components/Network";
import { replaceAllRefs } from "../variableReplacer";


interface APITestProps {
  api: APIData;
}

const APITest: React.FC<APITestProps> = ({ api }) => {
  const interfaces = api.interfaces || [];
  const examples = api.examples || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number | null>(examples.length > 0 ? 0 : null);

  const network = useNetwork();

  useEffect(() => {
    if (interfaces[selectedIdx]) {
      network.setRequestData({ ...interfaces[selectedIdx] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, interfaces]);

  // When example changes, fill requestData with example fields if available
  useEffect(() => {
    const selectedExample = selectedExampleIdx !== null ? examples[selectedExampleIdx] : undefined;
    if (
      selectedExample &&
      Array.isArray(selectedExample.inputs)
    ) {
      const exampleInputs = selectedExample.inputs.reduce(
        (acc, cur) => ({ ...acc, ...cur }),
        {}
      );
      const iface = interfaces[selectedIdx] || {};
      // Use async replaceAllRefs to handle i: and e: replacements
      replaceAllRefs(iface, exampleInputs, (replaced) => {
        network.setRequestData(replaced);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExampleIdx, selectedIdx]);

  const [formattedBody, setFormattedBody] = useState<string>(
    formatBody(network.requestData?.format || "json", network.requestData?.body || "")
  );

  useEffect(() => {
    setFormattedBody(
      formatBody(network.requestData?.format || "json", network.requestData?.body || "")
    );
  }, [network.requestData?.body, network.requestData?.format]);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [formattedBody]);

  // Helper to reset example selection
  const resetExample = () => setSelectedExampleIdx(null);

  const updateField = (field: keyof InterfaceData, value: any) => {
    resetExample();
    network.setRequestData({
      ...network.requestData,
      [field]: value,
    });
  };

  const handleSend = async () => {
    await network.send();
  };

  const handleConnect = () => {
    if (network.connected) {
      network.closeWs();
    } else {
      network.send({ protocol: "ws" });
    }
  };

  if (interfaces.length === 0) {
    return <div style={{ color: "#888" }}>No interfaces defined.</div>;
  }

  const req = network.requestData || {};

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
                onChange={e => setSelectedExampleIdx(Number(e.target.value))}
                style={{ width: "100%" }}
              >
                <option value="">Select example...</option>
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
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
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
            <input
              style={{ width: "100%" }}
              value={req.endpoint || ""}
              onChange={e => updateField("endpoint", e.target.value)}
            />
          </td>
        </tr>
        <KVEditor
          label="url params"
          value={req.query || {}}
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
              value={formattedBody}
              format={req.format}
              mode="test"
              onChange={val => {
                setFormattedBody(val);
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
                <div style={{ color: "#d32f2f", fontWeight: "bold", fontSize: 12, textAlign: "center" }}>
                  {network.error}
                </div>
              </div>
            </td>
          </tr>
        ) : (
          <>
            {Object.keys(network.responseHeaders || {}).length > 0 && (
              <tr>
                <td colSpan={2}>
                  <KVEditor
                    label="headers"
                    value={network.responseHeaders}
                    onChange={headers => { }}
                  />
                </td>
              </tr>
            )}
            {Object.keys(network.responseCookies || {}).length > 0 && (
              <tr>
                <td colSpan={2}>
                  <KVEditor
                    label="cookies"
                    value={network.responseCookies}
                    onChange={cookies => { }}
                  />
                </td>
              </tr>
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
                  format={req.format}
                  mode="test"
                  onChange={val => {
                    setFormattedBody(val);
                    updateField("body", val);
                  }}
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