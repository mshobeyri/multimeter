import React, { useContext } from "react";
import LEditor from "../components/LEditor";
import { DocData } from "mmt-core/DocData";
import DescriptionEditor from "../components/DescriptionEditor";
import FieldWithRemove from "../components/FieldWithRemove";
import FilePickerInput from "../components/FilePickerInput";
import { FileContext } from '../fileContext';

interface DocEditProps {
  doc: DocData;
  update: (patch: Partial<DocData>) => void;
}

const DocEdit: React.FC<DocEditProps> = ({ doc, update }) => {
  const services = doc.services || [];
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
          />
        </div>
      </div>

      <div className="panel-form-row">
        <LEditor
          label="Sources"
          value={doc.sources || []}
          onChange={kv => {
            update({ sources: kv });
          }}
          placeholder="file or folder path"
        />
      </div>

      <div className="panel-form-row doc-services">
        <div className="label">Services</div>
        {services.map((svc, idx) => (
          <div key={`service-${idx}`} className="inner-box doc-service-card">
            <FieldWithRemove
              value={svc?.name || ''}
              placeholder="service name"
              onChange={value => {
                const next = services.slice();
                next[idx] = { ...next[idx], name: value } as any;
                update({ services: next });
              }}
              onRemovePressed={() => {
                const next = services.slice();
                next.splice(idx, 1);
                update({ services: next });
              }}
            />
            <input
              value={(svc as any)?.description || ''}
              placeholder="service description (optional)"
              onChange={e => {
                const next = services.slice();
                next[idx] = { ...next[idx], description: e.target.value } as any;
                update({ services: next });
              }}
            />
            <LEditor
              label="Sources"
              value={(svc?.sources || []) as string[]}
              onChange={list => {
                const next = services.slice();
                next[idx] = { ...next[idx], sources: list } as any;
                update({ services: next });
              }}
              placeholder="file or folder path"
            />
          </div>
        ))}
        <button
          onClick={() => {
            const next = services.slice();
            next.push({ name: '', description: '', sources: [] } as any);
            update({ services: next });
          }}
        >
          Add service
        </button>
      </div>
    </div>
  );
};

export default DocEdit;