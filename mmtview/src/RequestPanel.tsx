import React, { useState } from "react";

const RequestPanel: React.FC<{ width: number }> = ({ width }) => {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("{}");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState("Response will appear here");

  const handleSend = async () => {
    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch {
      setResponse("Invalid JSON in headers");
      return;
    }

    let parsedBody: any = null;
    if (method !== "GET" && method !== "HEAD") {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setResponse("Invalid JSON in body");
        return;
      }
    }

    try {
      const res = await fetch(url, {
        method,
        headers: parsedHeaders,
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
      });
      const text = await res.text();
      setResponse(text);
    } catch (error: any) {
      setResponse("Error: " + error.message);
    }
  };

  return (
    <div
      id="request-panel"
      style={{
        flex: `0 0 ${width}%`,
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        minWidth: 100,
        maxWidth: "80vw",
        overflow: "auto",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", marginBottom: "0.5rem", width: "100%" }}>
        <select
          id="method"
          value={method}
          onChange={e => setMethod(e.target.value)}
          style={{ flex: "0 0 6rem", marginRight: "0.5rem" }}
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
        <input
          type="text"
          id="url"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ flex: "1 1 auto", marginRight: "0.5rem" }}
        />
        <button
          id="send"
          title="Send Request"
          onClick={handleSend}
          style={{
            height: "100%",
            aspectRatio: "1 / 1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            margin: 0,
            backgroundColor: "var(--vscode-button-background)",
            color: "var(--vscode-button-foreground)",
            border: "none",
            cursor: "pointer",
            borderRadius: "0.25rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <polygon points="5,3 17,10 5,17" />
          </svg>
        </button>
      </div>
      <textarea
        id="headers"
        placeholder="Headers (JSON format)"
        value={headers}
        onChange={e => setHeaders(e.target.value)}
        style={{ marginBottom: "0.5rem" }}
      />
      <textarea
        id="body"
        placeholder="Request Body (JSON format)"
        value={body}
        onChange={e => setBody(e.target.value)}
        style={{ marginBottom: "0.5rem" }}
      />
      <div id="response" style={{
        flex: 1,
        overflow: "auto",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        padding: "0.5rem",
        border: "1px solid var(--vscode-editorGroup-border)"
      }}>
        {response}
      </div>
    </div>
  );
};

export default RequestPanel;