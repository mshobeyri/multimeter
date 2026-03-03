import React, { useCallback, useEffect, useState } from 'react';
import { parseYaml, parseYamlDoc } from 'mmt-core/markupConvertor';
import { MockData, MockEndpoint } from 'mmt-core/MockData';

interface MockEditProps {
  content: string;
  setContent: (value: string) => void;
}

const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
const PROTOCOLS = ['http', 'https', 'ws'] as const;
const FORMATS = ['json', 'xml', 'text'] as const;

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--vscode-descriptionForeground)',
  marginBottom: 3,
  display: 'block',
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  fontSize: 12,
  borderRadius: 3,
  border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  boxSizing: 'border-box' as const,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--vscode-descriptionForeground)',
  marginBottom: 8,
  marginTop: 16,
};

const updateYamlField = (content: string, key: string, value: any): string | null => {
  try {
    const doc = parseYamlDoc(content);
    if (value === '' || value === undefined || value === null) {
      doc.delete(key);
    } else {
      doc.set(key, value);
    }
    return doc.toString();
  } catch {
    return null;
  }
};

const updateEndpointField = (
  content: string, index: number, key: string, value: any
): string | null => {
  try {
    const doc = parseYamlDoc(content);
    const endpoints = doc.get('endpoints') as any;
    if (!endpoints || !endpoints.items || !endpoints.items[index]) {
      return null;
    }
    const item = endpoints.items[index];
    if (value === '' || value === undefined || value === null) {
      if (item.delete) {
        item.delete(key);
      }
    } else {
      item.set(key, value);
    }
    return doc.toString();
  } catch {
    return null;
  }
};

const MockEdit: React.FC<MockEditProps> = ({ content, setContent }) => {
  const [data, setData] = useState<MockData | null>(null);

  useEffect(() => {
    try {
      const parsed = parseYaml(content);
      if (parsed && parsed.type === 'mock') {
        setData(parsed as MockData);
      }
    } catch {
      // ignore parse errors
    }
  }, [content]);

  const setField = useCallback((key: string, value: any) => {
    const updated = updateYamlField(content, key, value);
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const setEndpointField = useCallback((index: number, key: string, value: any) => {
    const updated = updateEndpointField(content, index, key, value);
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const addEndpoint = useCallback(() => {
    try {
      const doc = parseYamlDoc(content);
      const endpoints = doc.get('endpoints') as any;
      const newEp = { method: 'get', path: '/new-endpoint', status: 200, format: 'json', body: {} };
      if (endpoints && endpoints.items) {
        endpoints.add(doc.createNode(newEp));
      } else {
        doc.set('endpoints', [newEp]);
      }
      setContent(doc.toString());
    } catch {
      // ignore
    }
  }, [content, setContent]);

  const removeEndpoint = useCallback((index: number) => {
    try {
      const doc = parseYamlDoc(content);
      const endpoints = doc.get('endpoints') as any;
      if (endpoints && endpoints.items && endpoints.items[index]) {
        endpoints.items.splice(index, 1);
        setContent(doc.toString());
      }
    } catch {
      // ignore
    }
  }, [content, setContent]);

  if (!data) {
    return (
      <div style={{ padding: 16, color: 'var(--vscode-descriptionForeground)' }}>
        Unable to parse mock data for editing.
      </div>
    );
  }

  const endpoints = (data.endpoints || []) as MockEndpoint[];

  return (
    <div style={{ overflow: 'auto', padding: '0 16px 16px', height: '100%' }}>
      {/* Server Settings */}
      <div style={sectionTitle}>Server Settings</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={fieldLabel}>Title</label>
          <input
            type="text"
            value={data.title || ''}
            onChange={e => setField('title', e.target.value || undefined)}
            placeholder="Mock server title"
            style={fieldInput}
          />
        </div>
        <div>
          <label style={fieldLabel}>Port</label>
          <input
            type="number"
            value={data.port || ''}
            onChange={e => setField('port', parseInt(e.target.value, 10) || undefined)}
            placeholder="8080"
            min={1}
            max={65535}
            style={fieldInput}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={fieldLabel}>Protocol</label>
          <select
            value={data.protocol || 'http'}
            onChange={e => setField('protocol', e.target.value === 'http' ? undefined : e.target.value)}
            style={{ ...fieldInput, padding: '4px 6px' }}
          >
            {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label style={fieldLabel}>Delay (ms)</label>
          <input
            type="number"
            value={data.delay || 0}
            onChange={e => setField('delay', parseInt(e.target.value, 10) || undefined)}
            min={0}
            style={fieldInput}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 2 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!data.cors}
              onChange={e => setField('cors', e.target.checked || undefined)}
            />
            CORS
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={fieldLabel}>Description</label>
        <textarea
          value={data.description || ''}
          onChange={e => setField('description', e.target.value || undefined)}
          placeholder="Optional description"
          rows={2}
          style={{ ...fieldInput, resize: 'vertical' }}
        />
      </div>

      {/* Endpoints */}
      <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Endpoints ({endpoints.length})</span>
        <button
          onClick={addEndpoint}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 3,
            border: '1px solid var(--vscode-panel-border)',
            backgroundColor: 'transparent',
            color: 'var(--vscode-descriptionForeground)',
            cursor: 'pointer',
            textTransform: 'none',
            fontWeight: 400,
          }}
        >
          <span className="codicon codicon-add" style={{ marginRight: 4, fontSize: 11 }} />
          Add
        </button>
      </div>

      {endpoints.map((ep, idx) => (
        <EndpointEditCard
          key={idx}
          endpoint={ep}
          index={idx}
          onChange={setEndpointField}
          onRemove={removeEndpoint}
        />
      ))}

      {endpoints.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
          No endpoints defined. Click "Add" to create one.
        </div>
      )}
    </div>
  );
};

/* ─── Endpoint edit card ─── */

interface EndpointEditCardProps {
  endpoint: MockEndpoint;
  index: number;
  onChange: (index: number, key: string, value: any) => void;
  onRemove: (index: number) => void;
}

const METHOD_COLORS: Record<string, string> = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  patch: '#e5c07b',
  delete: '#f93e3e',
  head: '#9012fe',
  options: '#0d5aa7',
};

const EndpointEditCard: React.FC<EndpointEditCardProps> = ({ endpoint, index, onChange, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const method = (endpoint.method || 'get').toLowerCase();

  return (
    <div style={{
      marginBottom: 6,
      borderRadius: 4,
      border: '1px solid var(--vscode-panel-border)',
      backgroundColor: 'var(--vscode-editor-background)',
      overflow: 'hidden',
    }}>
      {/* Collapsed header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`codicon codicon-chevron-${expanded ? 'down' : 'right'}`}
          style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }} />
        <span style={{ fontWeight: 700, color: METHOD_COLORS[method] || 'inherit', minWidth: 52 }}>
          {method.toUpperCase()}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {endpoint.path}
        </span>
        {endpoint.name && (
          <span style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            backgroundColor: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
          }}>
            {endpoint.name}
          </span>
        )}
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {endpoint.reflect ? 'reflect' : endpoint.status ?? 200}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(index); }}
          title="Remove endpoint"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          <span className="codicon codicon-trash" style={{ fontSize: 12 }} />
        </button>
      </div>

      {/* Expanded edit fields */}
      {expanded && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--vscode-panel-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={fieldLabel}>Method</label>
              <select
                value={method}
                onChange={e => onChange(index, 'method', e.target.value)}
                style={{ ...fieldInput, padding: '4px 6px' }}
              >
                {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Path</label>
              <input
                type="text"
                value={endpoint.path || ''}
                onChange={e => onChange(index, 'path', e.target.value)}
                placeholder="/endpoint"
                style={fieldInput}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={fieldLabel}>Status</label>
              <input
                type="number"
                value={endpoint.status ?? 200}
                onChange={e => onChange(index, 'status', parseInt(e.target.value, 10) || 200)}
                min={100}
                max={599}
                style={fieldInput}
              />
            </div>
            <div>
              <label style={fieldLabel}>Format</label>
              <select
                value={endpoint.format || ''}
                onChange={e => onChange(index, 'format', e.target.value || undefined)}
                style={{ ...fieldInput, padding: '4px 6px' }}
              >
                <option value="">auto</option>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Name</label>
              <input
                type="text"
                value={endpoint.name || ''}
                onChange={e => onChange(index, 'name', e.target.value || undefined)}
                placeholder="optional"
                style={fieldInput}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={fieldLabel}>Delay (ms)</label>
              <input
                type="number"
                value={endpoint.delay ?? ''}
                onChange={e => onChange(index, 'delay', parseInt(e.target.value, 10) || undefined)}
                min={0}
                placeholder="inherited"
                style={fieldInput}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 2 }}>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!endpoint.reflect}
                  onChange={e => onChange(index, 'reflect', e.target.checked || undefined)}
                />
                Reflect
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockEdit;
