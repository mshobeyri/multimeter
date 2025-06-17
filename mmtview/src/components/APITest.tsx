import React, { useState, useRef, useEffect } from "react";
import { InterfaceData, APIData } from "./APIData";
import KVEditor from "./KVEditor";
import BodyView from "./BodyView";
import { formatBody } from "../markupConvertor";
import SendButton from "./SendButton";
import ConnectButton from "./ConnectButton";
import { useNetwork } from "./Network";

interface APITestProps {
  api: APIData;
}

const APITest: React.FC<APITestProps> = ({ api }) => {
  const interfaces = api.interfaces || [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  const network = useNetwork();

  useEffect(() => {
    if (interfaces[selectedIdx]) {
      network.setRequestData({ ...interfaces[selectedIdx] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, interfaces]);

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

  const updateField = (field: keyof InterfaceData, value: any) => {
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
        <tr>
          <td className="label">interface</td>
          <td style={{ padding: "8px" }}>
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              style={{ width: "100%" }}
            >
              {interfaces.map((iface, idx) => (
                <option key={iface.name || idx} value={idx}>
                  {iface.name || `Interface ${idx + 1}`}
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
            <SendButton onClick={handleSend} />
          </td>
        </tr>
        <div>
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
                  typeof network.responseBody === "string"
                    ? network.responseBody
                    : JSON.stringify(network.responseBody ?? "", null, 2)
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
        </div >
      </tbody>
    </table>
  );
};

export default APITest;