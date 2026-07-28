import React from "react";
import { MockConnectionConfig, MockConnectionMode, MockData } from "mmt-core/MockData";
import { parseYamlDoc } from "mmt-core/markupConvertor";
import FilePickerInput from "../components/FilePickerInput";
import KSVEditor from "../components/KSVEditor";
import { FileContext } from "../fileContext";
import { canonicalizeMockYaml } from "./mockYaml";

interface MockServerSettingsProps {
  data: MockData;
  updateField: (key: string, value: any) => void;
  content: string;
  setContent: (value: string) => void;
}

const PROTOCOLS = ['http', 'https', 'ws'] as const;
const CONNECTION_MODES: MockConnectionMode[] = ['plain', 'tls', 'mtls'];
const CERT_FILTERS = [{ name: 'Certificate files', extensions: ['pem', 'crt', 'cer'] }];
const KEY_FILTERS = [{ name: 'Key files', extensions: ['key', 'pem'] }];

const MockServerSettings: React.FC<MockServerSettingsProps> = ({ data, updateField, content, setContent }) => {
  const fileContext = React.useContext(FileContext);
  const connection = data.connection && typeof data.connection === 'object' ? data.connection : undefined;
  const protocolValue = typeof data.protocol === 'string' ? data.protocol : 'http';
  const connectionMode = (typeof connection?.mode === 'string' ? connection.mode : undefined)
    || (protocolValue === 'https' ? 'tls' : 'plain');
  const showTlsFiles = connectionMode !== 'plain' || protocolValue === 'https';

  const setConnection = React.useCallback((nextConnection: MockConnectionConfig | undefined, forceHttps = false) => {
    try {
      const doc = parseYamlDoc(content);
      if (forceHttps) {
        doc.set('protocol', 'https');
      }
      if (!nextConnection || isEmptyConnection(nextConnection)) {
        doc.delete('connection');
      } else {
        doc.set('connection', nextConnection);
      }
      setContent(canonicalizeMockYaml(doc.toString()));
    } catch {
      updateField('connection', nextConnection && !isEmptyConnection(nextConnection) ? nextConnection : undefined);
      if (forceHttps) {
        updateField('protocol', 'https');
      }
    }
  }, [content, setContent, updateField]);

  const updateConnectionMode = (mode: MockConnectionMode) => {
    if (mode === 'plain') {
      setPlainConnection();
      return;
    }
    setConnection({ ...(connection || {}), mode }, true);
  };

  const setPlainConnection = () => {
    try {
      const doc = parseYamlDoc(content);
      doc.delete('protocol');
      doc.delete('connection');
      setContent(canonicalizeMockYaml(doc.toString()));
    } catch {
      updateField('protocol', undefined);
      updateField('connection', undefined);
    }
  };

  const updateProtocol = (protocol: string) => {
    try {
      const doc = parseYamlDoc(content);
      if (protocol === 'http') {
        doc.delete('protocol');
        doc.delete('connection');
      } else {
        doc.set('protocol', protocol);
        if (protocol !== 'https') {
          doc.delete('connection');
        }
      }
      setContent(canonicalizeMockYaml(doc.toString()));
    } catch {
      updateField('protocol', protocol === 'http' ? undefined : protocol);
      if (protocol !== 'https') {
        updateField('connection', undefined);
      }
    }
  };

  const updateConnectionField = (key: keyof MockConnectionConfig, value: string) => {
    const next = {
      ...(connection || { mode: connectionMode === 'plain' ? 'tls' : connectionMode }),
      [key]: value || undefined,
    } as MockConnectionConfig;
    setConnection(cleanConnection(next), true);
  };

  return (
    <div className="mock-edit-tab-content">
      <div className="label" style={{ marginBottom: 6 }}>Port</div>
      <input
        type="text"
        className="vscode-input"
        value={data.port ?? ''}
        onChange={e => {
          const raw = e.target.value.trim();
          if (!raw) {
            updateField('port', undefined);
            return;
          }
          if (/^\d+$/.test(raw)) {
            updateField('port', Number(raw));
            return;
          }
          updateField('port', raw);
        }}
        placeholder="8080 or e:MOCK_PORT"
        style={{ width: '100%', marginBottom: 12 }}
      />

      <div className="label" style={{ marginBottom: 6 }}>Protocol</div>
      <select
        className="vscode-input"
        value={PROTOCOLS.includes(protocolValue as any) ? protocolValue : 'http'}
        onChange={e => updateProtocol(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      >
        {PROTOCOLS.map(protocol => <option key={protocol} value={protocol}>{protocol.toUpperCase()}</option>)}
      </select>
      {typeof data.protocol === 'string' && !PROTOCOLS.includes(data.protocol as any) && (
        <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: -8, marginBottom: 12 }}>
          Using env token <code>{data.protocol}</code> from YAML
        </div>
      )}

      <div className="label" style={{ marginBottom: 6 }}>Connection</div>
      <select
        className="vscode-input"
        value={connectionMode}
        onChange={e => updateConnectionMode(e.target.value as MockConnectionMode)}
        style={{ width: '100%', marginBottom: 12 }}
      >
        {CONNECTION_MODES.map(mode => <option key={mode} value={mode}>{mode === 'mtls' ? 'mTLS' : mode.toUpperCase()}</option>)}
      </select>

      {showTlsFiles && (
        <div className="mock-server-cert-fields">
          <div className="label" style={{ marginBottom: 6 }}>Server Certificate File</div>
          <FilePickerInput
            value={connection?.cert || ''}
            onChange={value => updateConnectionField('cert', value)}
            onEnterPressed={value => updateConnectionField('cert', value)}
            basePath={fileContext.mmtFilePath}
            filters={CERT_FILTERS}
            showFilePicker
            placeholder="./certs/server.crt"
          />

          <div className="label" style={{ marginBottom: 6 }}>Server Key File</div>
          <FilePickerInput
            value={connection?.key || ''}
            onChange={value => updateConnectionField('key', value)}
            onEnterPressed={value => updateConnectionField('key', value)}
            basePath={fileContext.mmtFilePath}
            filters={KEY_FILTERS}
            showFilePicker
            placeholder="./certs/server.key"
          />

          {connectionMode === 'mtls' && (
            <>
              <div className="label" style={{ marginBottom: 6 }}>Client CA File</div>
              <FilePickerInput
                value={connection?.client_ca || ''}
                onChange={value => updateConnectionField('client_ca', value)}
                onEnterPressed={value => updateConnectionField('client_ca', value)}
                basePath={fileContext.mmtFilePath}
                filters={CERT_FILTERS}
                showFilePicker
                placeholder="./certs/ca.crt"
              />
            </>
          )}
        </div>
      )}

      <div className="label" style={{ marginBottom: 6 }}>Delay</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          className="vscode-input"
          value={data.delay || ''}
          onChange={e => updateField('delay', parseInt(e.target.value, 10) || undefined)}
          min={0}
          placeholder="0"
          style={{ flex: 1, width: '100%' }}
        />
        <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>ms</span>
      </div>

      <label className="mock-server-checkbox-row">
        <input
          type="checkbox"
          checked={!!data.cors}
          onChange={e => updateField('cors', e.target.checked || undefined)}
        />
        <span>CORS</span>
      </label>

      <KSVEditor
        label="Headers"
        value={data.headers}
        onChange={kv => {
          const cleaned = Object.fromEntries(Object.entries(kv).filter(([key]) => key.trim()));
          updateField('headers', Object.keys(cleaned).length > 0 ? cleaned : undefined);
        }}
        keyPlaceholder="Header name"
        valuePlaceholder="value"
      />

      <div className="label" style={{ marginBottom: 6 }}>Proxy</div>
      <input
        type="text"
        className="vscode-input"
        value={data.proxy || ''}
        onChange={e => updateField('proxy', e.target.value || undefined)}
        placeholder="Forward unmatched requests to URL"
        style={{ width: '100%' }}
      />
    </div>
  );
};

function cleanConnection(connection: MockConnectionConfig): MockConnectionConfig {
  return Object.fromEntries(
    Object.entries(connection).filter(([, value]) => value !== undefined && value !== '')
  ) as MockConnectionConfig;
}

function isEmptyConnection(connection: MockConnectionConfig): boolean {
  const cleaned = cleanConnection(connection);
  return Object.keys(cleaned).length === 0 || (Object.keys(cleaned).length === 1 && cleaned.mode === 'plain');
}

export default MockServerSettings;