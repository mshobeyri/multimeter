import React, { useState, useRef, useEffect } from "react";
import { InterfaceData, ResponseData, APIData } from "./APIData";
import KVEditor from "./KVEditor"
import BodyView from "./BodyView";
import { formatBody } from "../markupConvertor";
import SendButton from "./SendButton";
import ConnectButton from "./ConnectButton";
import axios from "axios";

interface APITestProps {
  api: APIData;
}

const APITest: React.FC<APITestProps> = ({ api }) => {
  const interfaces = api.interfaces || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [connected, setConnected] = useState(false);

  // Local state for editing the selected interface (does not affect YAML)
  const [testData, setTestData] = useState<InterfaceData>(
    interfaces[selectedIdx]
      ? { ...interfaces[selectedIdx] }
      : {
        name: "",
        protocol: "http",
        format: "json",
        endpoint: "",
        headers: {},
        body: "",
        query: {},
        params: {},
        cookies: {},
      }
  );

  const [response, setResponse] = useState<ResponseData>(
    { body: "" }
  );



  // State for formatted body
  const [formattedBody, setFormattedBody] = useState<string>(
    formatBody(testData.format, testData.body || "")
  );

  // Update local testData when selected interface changes
  useEffect(() => {
    if (interfaces[selectedIdx]) {
      setTestData({ ...interfaces[selectedIdx] });
    }
  }, [selectedIdx, interfaces]);

  // Update formattedBody when body or format changes
  useEffect(() => {
    setFormattedBody(formatBody(testData.format, testData.body || ""));
  }, [testData.body, testData.format]);

  // Auto-resize textarea for body
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [formattedBody]);

  if (interfaces.length === 0) {
    return <div style={{ color: "#888" }}>No interfaces defined.</div>;
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed"
      }}
    >
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
              value={testData.endpoint}
              onChange={e => setTestData({ ...testData, endpoint: e.target.value })}
            />
          </td>
        </tr>
        <KVEditor
          label="url params"
          value={testData.query}
          onChange={query => setTestData({ ...testData, query })}
        />
        <KVEditor
          label="headers"
          value={testData.headers}
          onChange={headers => setTestData({ ...testData, headers })}
        />
        <KVEditor
          label="cookies"
          value={testData.cookies}
          onChange={cookies => setTestData({ ...testData, cookies })}
        />
        <tr>
          <td className="label" >
            body
          </td>
          <td style={{ padding: "8px" }}>
            <BodyView
              value={formattedBody}
              format={testData.format}
              mode="test"
              onChange={val => {
                setFormattedBody(val);
                setTestData({ ...testData, body: val });
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
            {testData.protocol === "ws" && (
              <ConnectButton
                connected={connected}
                onClick={() => setConnected(c => !c)}
              />
            )}
            <SendButton onClick={handleSend} />
          </td>
        </tr>
        <KVEditor
          label="headers"
          value={response.headers}
          onChange={headers => setTestData({ ...testData, headers })}
        />
        <KVEditor
          label="cookies"
          value={response.cookies}
          onChange={cookies => setTestData({ ...testData, cookies })}
        />
        <tr>
          <td className="label" >
            response
          </td>
          <td style={{ padding: "8px" }}>
            <BodyView
              value={typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "", null, 2)}
              format={testData.format}
              mode="test"
              onChange={val => {
                setFormattedBody(val);
                setTestData({ ...testData, body: val });
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default APITest;