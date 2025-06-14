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
            <button
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px #0001",
                padding: 0,
              }}
              title="Send"
              onClick={() => {
                // TODO: Implement send/test logic here
                alert("Send clicked!");
              }}
            >
              {/* Paper fly icon */}
              <svg
                fill="#fff"
                viewBox="0 0 256 256"
                width="22"
                height="22"
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginLeft: "4px" }} // Move icon 4px to the right
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