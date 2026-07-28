import React, { useState } from "react";
import { accentChromeFor } from "../shared/themeAccent";

// APIData type should match what yamlToAPI returns
interface APIData {
  title?: string;
  description?: string;
  url: string;
  method?: string;
  tags?: string[];
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: any;
  format?: string;
}

interface DocElementsDrawerProps {
  apis: APIData[];
  docTitle?: string;
  docDescription?: string;
}

function groupByTag(apis: APIData[]) {
  const groups: Record<string, APIData[]> = {};
  for (const api of apis) {
    const tags = api.tags && api.tags.length ? api.tags : ["default"];
    for (const tag of tags) {
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(api);
    }
  }
  return groups;
}

const DocElementsDrawer: React.FC<DocElementsDrawerProps> = ({ apis, docTitle, docDescription }) => {
  const groups = groupByTag(apis);
  // openApi: key is `${tag}:${idx}` for each API drawer
  const [openApi, setOpenApi] = useState<Record<string, boolean>>({});

  return (
    <div className="doc-elements-root">
      <h1 className="doc-elements-title">{docTitle || "Documentation"}</h1>
      {docDescription && <div className="doc-elements-desc">{docDescription}</div>}
      {Object.entries(groups).map(([tag, group]) => (
        <div key={tag} className="doc-elements-group">
          <div className="doc-elements-group-header">
            <span className="doc-elements-group-title">{tag}</span>
          </div>
          <div className="doc-elements-group-content">
            {group.map((api, idx) => {
              const apiKey = `${tag}:${idx}`;
              // Detect protocol: ws if url starts with ws:// or wss://
              let proto = typeof api.method === 'string' ? api.method.toUpperCase() : '';
              if (/^ws(s)?:\/\//i.test(String(api.url || ''))) proto = 'WS';
              return (
                <div key={apiKey} className="doc-elements-api">
                  <div
                    className="doc-elements-api-header"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setOpenApi(o => ({ ...o, [apiKey]: !o[apiKey] }))}
                  >
                    <span
                      className="doc-elements-method-badge"
                      style={(() => {
                        const chrome = accentChromeFor(
                          typeof api.method === 'string' ? api.method : 'get',
                        );
                        return {
                          background: chrome.softFill,
                          color: chrome.text,
                          border: `1px solid ${chrome.border}`,
                        };
                      })()}
                    >
                      {proto || "GET"}
                    </span>
                    <span className="doc-elements-api-title" style={{ marginLeft: 8, fontWeight: 600 }}>
                      {api.title || api.url}
                    </span>
                    <span style={{ marginLeft: 8, color: '#888' }}>{openApi[apiKey] ? "▼" : "▶"}</span>
                  </div>
                  {openApi[apiKey] && (
                    <>
                      {api.description && <div className="doc-elements-api-desc">{api.description}</div>}
                      <div className="doc-elements-api-details">
                        {api.headers && Object.keys(api.headers).length > 0 && (
                          <div>
                            <strong>Headers:</strong>
                            <pre>{JSON.stringify(api.headers, null, 2)}</pre>
                          </div>
                        )}
                        {api.query && Object.keys(api.query).length > 0 && (
                          <div>
                            <strong>Query:</strong>
                            <pre>{JSON.stringify(api.query, null, 2)}</pre>
                          </div>
                        )}
                        {api.cookies && Object.keys(api.cookies).length > 0 && (
                          <div>
                            <strong>Cookies:</strong>
                            <pre>{JSON.stringify(api.cookies, null, 2)}</pre>
                          </div>
                        )}
                        {api.body && (
                          <div>
                            <strong>Body{api.format ? ` (${api.format})` : ""}:</strong>
                            <pre>{typeof api.body === "string" ? api.body : JSON.stringify(api.body, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocElementsDrawer;
