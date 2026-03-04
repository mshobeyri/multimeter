import React from "react";
import { MockData } from "mmt-core/MockData";
import SearchableTagInput from "../components/SearchableTagInput";
import KSVEditor from "../components/KSVEditor";
import DescriptionEditor from "../components/DescriptionEditor";

interface MockOverviewProps {
  data: MockData;
  updateField: (key: string, value: any) => void;
  content: string;
  setContent: (value: string) => void;
}

const PROTOCOLS = ['http', 'https', 'ws'] as const;

const MockOverview: React.FC<MockOverviewProps> = ({ data, updateField, content, setContent }) => {
  return (
    <div style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <div className="label">Title</div>
      <div style={{ padding: "5px" }}>
        <input
          value={data.title || ""}
          onChange={e => updateField('title', e.target.value || undefined)}
          placeholder="Mock server title"
          style={{ width: "100%" }}
        />
      </div>

      <div className="label">Tags</div>
      <div style={{ padding: "5px" }}>
        <SearchableTagInput
          tags={data.tags || []}
          onChange={tags => updateField('tags', tags.length > 0 ? tags : undefined)}
          suggestions={["users", "auth", "demo", "mock", "api"]}
        />
      </div>

      <div className="label">Description</div>
      <div style={{ padding: "5px", width: "100%" }}>
        <DescriptionEditor
          value={data.description || ""}
          onChange={value => updateField('description', value || undefined)}
        />
      </div>

      {/* Server settings – one param per row */}
      <div className="label">Server</div>
      <div style={{ padding: '5px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', width: 64, flexShrink: 0 }}>Port</span>
          <input
            type="number"
            value={data.port || ''}
            onChange={e => updateField('port', parseInt(e.target.value, 10) || undefined)}
            placeholder="8080"
            min={1}
            max={65535}
            style={{ flex: 1, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', width: 64, flexShrink: 0 }}>Protocol</span>
          <select
            value={data.protocol || 'http'}
            onChange={e => updateField('protocol', e.target.value === 'http' ? undefined : e.target.value)}
            style={{ flex: 1, padding: '4px 6px' }}
          >
            {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', width: 64, flexShrink: 0 }}>Delay</span>
          <input
            type="number"
            value={data.delay || 0}
            onChange={e => updateField('delay', parseInt(e.target.value, 10) || undefined)}
            min={0}
            placeholder="0"
            style={{ flex: 1, width: '100%' }}
          />
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>ms</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', width: 64, flexShrink: 0 }}>CORS</span>
          <input
            type="checkbox"
            checked={!!data.cors}
            onChange={e => updateField('cors', e.target.checked || undefined)}
          />
        </div>
      </div>

      <KSVEditor
        label="Headers"
        value={data.headers}
        onChange={kv => {
          const cleaned = Object.fromEntries(
            Object.entries(kv).filter(([k]) => k.trim())
          );
          updateField('headers', Object.keys(cleaned).length > 0 ? cleaned : undefined);
        }}
        keyPlaceholder="Header name"
        valuePlaceholder="value"
      />

      {/* Proxy */}
      <div className="label">Proxy</div>
      <div style={{ padding: "5px" }}>
        <input
          value={data.proxy || ""}
          onChange={e => updateField('proxy', e.target.value || undefined)}
          placeholder="Forward unmatched requests to URL (optional)"
          style={{ width: "100%" }}
        />
      </div>


    </div>
  );
};

export default MockOverview;
