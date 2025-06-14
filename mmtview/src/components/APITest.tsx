import React, { useState, useRef, useEffect } from "react";
import { InterfaceData, APIData } from "./APIData";
import KVEditor from "./KVEditor"
import BodyView from "./BodyView";
import { formatBody } from "../markupConvertor";

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
          <td className="label" style={{ verticalAlign: "top" }}>
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
            {/* Connect button */}
            <button
              style={{
                position: "absolute",
                right: "45px",
                top: "50%",
                transform: "translateY(-50%)",
                background: connected ? "#d32f2f" : "#43a047", // green if connected, red if disconnected
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px #0001",
                padding: 0,
                marginRight: "8px",
                transition: "background 0.2s"
              }}
              title={connected ? "Disconnect" : "Connect"}
              onClick={() => setConnected(c => !c)}
            >
              {connected ? (
                // Connected icon
                <svg viewBox="0 0 24 24" width="15.4" height="15.4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.7,19.3l-1-1c-0.4-0.4-1-0.4-1.4,0s-0.4,1,0,1.4l1,1c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3
        C21.1,20.3,21.1,19.7,20.7,19.3z" fill="#fff"/>
                  <path d="M14,22c0,0.6,0.4,1,1,1s1-0.4,1-1v-2c0-0.6-0.4-1-1-1s-1,0.4-1,1V22z" fill="#fff"/>
                  <path d="M22,14h-2c-0.6,0-1,0.4-1,1s0.4,1,1,1h2c0.6,0,1-0.4,1-1S22.6,14,22,14z" fill="#fff"/>
                  <path d="M20.7,8.4c0-1.4-0.5-2.6-1.5-3.6c-1-1-2.2-1.5-3.6-1.5S13,3.8,12,4.8L9.8,7c-0.4,0.4-0.4,1,0,1.4s1,0.4,1.4,0l2.2-2.2
        c1.2-1.2,3.2-1.2,4.4,0c0.6,0.6,0.9,1.4,0.9,2.2c0,0.8-0.3,1.6-0.9,2.2l-2.2,2.2c-0.4,0.4-0.4,1,0,1.4c0.2,0.2,0.5,0.3,0.7,0.3
        s0.5-0.1,0.7-0.3l2.2-2.2C20.2,11,20.7,9.8,20.7,8.4z" fill="#fff"/>
                  <path d="M3.3,15.6c0,1.4,0.5,2.6,1.5,3.6c1,1,2.2,1.5,3.6,1.5s2.6-0.5,3.6-1.5l2.2-2.2c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0
        l-2.2,2.2c-1.2,1.2-3.2,1.2-4.4,0c-0.6-0.6-0.9-1.4-0.9-2.2c0-0.8,0.3-1.6,0.9-2.2l2.2-2.2c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0
        L4.8,12C3.8,13,3.3,14.2,3.3,15.6z" fill="#fff"/>
                  <path d="M5.7,4.3l-1-1c-0.4-0.4-1-0.4-1.4,0s-0.4,1,0,1.4l1,1C4.5,5.9,4.7,6,5,6s0.5-0.1,0.7-0.3C6.1,5.3,6.1,4.7,5.7,4.3z" fill="#fff"/>
                  <path d="M10,4V2c0-0.6-0.4-1-1-1S8,1.4,8,2v2c0,0.6,0.4,1,1,1S10,4.6,10,4z" fill="#fff"/>
                  <path d="M4,10c0.6,0,1-0.4,1-1S4.6,8,4,8H2C1.4,8,1,8.4,1,9s0.4,1,1,1H4z" fill="#fff"/>
                </svg>
              ) : (
                // Disconnected icon
                <svg viewBox="0 0 24 24" width="15.4" height="15.4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 10C14 9.44771 13.5523 9 13 9H12.5C9.46243 9 7 11.4624 7 14.5C7 17.5376 9.46243 20 12.5 20H17.5C20.5376 20 23 17.5376 23 14.5C23 12.0091 21.3441 9.90488 19.073 9.22823C18.5098 9.06042 18 9.52887 18 10.1166V10.1683C18 10.6659 18.3745 11.0735 18.8345 11.2634C20.1055 11.788 21 13.0395 21 14.5C21 16.433 19.433 18 17.5 18H12.5C10.567 18 9 16.433 9 14.5C9 12.567 10.567 11 12.5 11H13C13.5523 11 14 10.5523 14 10Z" fill="#fff"/>
                  <path d="M11.5 4C14.5376 4 17 6.46243 17 9.5C17 12.5376 14.5376 15 11.5 15H11C10.4477 15 10 14.5523 10 14C10 13.4477 10.4477 13 11 13H11.5C13.433 13 15 11.433 15 9.5C15 7.567 13.433 6 11.5 6H6.5C4.567 6 3 7.567 3 9.5C3 10.9605 3.89451 12.212 5.16553 12.7366C5.62548 12.9264 6 13.3341 6 13.8317V13.8834C6 14.4711 5.49024 14.9396 4.92699 14.7718C2.65592 14.0951 1 11.9909 1 9.5C1 6.46243 3.46243 4 6.5 4H11.5Z" fill="#fff"/>
                </svg>
              )}
            </button>
            {/* Send button */}
            <button
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "#43a047",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px #0001",
                padding: 0,
              }}
              title="Send"
              onClick={() => {
                alert("Send clicked!");
              }}
            >
              <svg
                fill="#fff"
                viewBox="0 0 256 256"
                width="15.4"
                height="15.4"
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginLeft: "4px" }}
              >
                <path d="M225.39844,110.5498,56.4834,15.957A20,20,0,0,0,27.877,40.13477L59.25781,128,27.877,215.86621A19.97134,19.97134,0,0,0,56.48437,240.042L225.39844,145.4502a19.99958,19.99958,0,0,0,0-34.9004ZM54.06738,213.88867,80.45605,140H136a12,12,0,0,0,0-24H80.45654L54.06738,42.11133,207.44043,128Z"></path>
              </svg>
            </button>
          </td>
        </tr>
        <tr>
          <td className="label" style={{ verticalAlign: "top" }}>
            response
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
      </tbody>
    </table>
  );
};

export default APITest;