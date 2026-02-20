import React, { useContext } from "react";
import { DocData } from "mmt-core/DocData";
import DescriptionEditor from "../components/DescriptionEditor";
import FilePickerInput from "../components/FilePickerInput";
import { FileContext } from '../fileContext';

interface DocOverviewProps {
  doc: DocData;
  update: (patch: Partial<DocData>) => void;
}

const DocOverview: React.FC<DocOverviewProps> = ({ doc, update }) => {
  const fileCtx = useContext(FileContext);

  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <div className="label">Title</div>
        <input
          value={doc.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Description</div>
        <DescriptionEditor
          value={doc.description || ""}
          onChange={value => update({ description: value })}
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Logo</div>
        <div style={{ width: '100%' }}>
          <FilePickerInput
            value={doc.logo || ''}
            onChange={val => update({ logo: val })}
            onRemovePressed={() => update({ logo: '' })}
            basePath={fileCtx?.mmtFilePath}
            filters={[{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'] }]}
            removable={true}
            showFilePicker={true}
          />
        </div>
      </div>

      <div className="panel-form-row">
        <div className="label">HTML Options</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ whiteSpace: 'nowrap', width: '25%', flexShrink: 0 }}>Triable:</span>
            <select
              value={doc.html?.triable ? "enabled" : "disabled"}
              onChange={e => {
                const html = { ...(doc.html || {}), triable: e.target.value === "enabled" };
                update({ html });
              }}
              style={{ flex: 1 }}
            >
              <option value="disabled">Disabled</option>
              <option value="enabled">Enabled</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ whiteSpace: 'nowrap', width: '25%', flexShrink: 0 }}>CORS Proxy:</span>
            <input
              value={doc.html?.cors_proxy || ''}
              onChange={e => {
                const html = { ...(doc.html || {}), cors_proxy: e.target.value };
                update({ html });
              }}
              placeholder="https://corsproxy.io/?"
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocOverview;
