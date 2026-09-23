import React, { useContext } from "react";
import { DocData } from "mmt-core/DocData";
import DescriptionEditor from "../components/DescriptionEditor";
import FilePickerInput from "../components/FilePickerInput";
import KSVEditor from "../components/KSVEditor";
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
        <div className="mmt-fill">
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
        <KSVEditor
          label="Import"
          value={doc.import}
          onChange={imports => update({ import: imports })}
          keyPlaceholder="alias"
          valuePlaceholder="path"
          filePicker={true}
          filePickerFilters={[
            { name: 'Data files', extensions: ['json', 'yaml', 'yml', 'csv'] },
          ]}
        />
      </div>

      <div className="panel-form-row">
        <div className="label">HTML Options</div>
        <div className="field-stack is-gap mmt-fill">
          <div className="field-inline is-gap">
            <span className="field-label-col is-quarter">Triable:</span>
            <select
              className="field-grow"
              value={doc.html?.triable ? "enabled" : "disabled"}
              onChange={e => {
                const html = { ...(doc.html || {}), triable: e.target.value === "enabled" };
                update({ html });
              }}
            >
              <option value="disabled">Disabled</option>
              <option value="enabled">Enabled</option>
            </select>
          </div>
          <div className="field-inline is-gap">
            <span className="field-label-col is-quarter">CORS Proxy:</span>
            <input
              className="field-grow"
              value={doc.html?.cors_proxy || ''}
              onChange={e => {
                const html = { ...(doc.html || {}), cors_proxy: e.target.value };
                update({ html });
              }}
              placeholder="https://corsproxy.io/?"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocOverview;
